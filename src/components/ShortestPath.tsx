import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  Play, 
  RotateCcw, 
  Trash2, 
  MousePointer,
  Flag,
  Square
} from "lucide-react";

// Node types for the grid
export interface GridNode {
  x: number;
  y: number;
  isWall: boolean;
  isStart: boolean;
  isEnd: boolean;
  isVisited: boolean;
  isPath: boolean;
  gScore: number;
  hScore: number;
  fScore: number;
  parent: GridNode | null;
}

type Tool = "start" | "end" | "wall";

interface AlgorithmStats {
  algorithm: string;
  nodesExplored: number;
  pathLength: number;
}

const GRID_COLS = 50;
const GRID_ROWS = 30;
const CELL_SIZE = 20;
const ANIMATION_SPEED = 10; // ms between frames

export default function ShortestPath() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [grid, setGrid] = useState<GridNode[][]>([]);
  const [selectedTool, setSelectedTool] = useState<Tool>("start");
  const [isDrawing, setIsDrawing] = useState(false);
  const [startNode, setStartNode] = useState<GridNode | null>(null);
  const [endNode, setEndNode] = useState<GridNode | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [stats, setStats] = useState<AlgorithmStats>({
    algorithm: "---",
    nodesExplored: 0,
    pathLength: 0,
  });

  // Initialize grid
  useEffect(() => {
    const newGrid: GridNode[][] = [];
    for (let y = 0; y < GRID_ROWS; y++) {
      const row: GridNode[] = [];
      for (let x = 0; x < GRID_COLS; x++) {
        const isStart = x === 5 && y === 15;
        const isEnd = x === 44 && y === 15;
        
        row.push({
          x,
          y,
          isWall: false,
          isStart,
          isEnd,
          isVisited: false,
          isPath: false,
          gScore: Infinity,
          hScore: 0,
          fScore: Infinity,
          parent: null,
        });
      }
      newGrid.push(row);
    }
    
    // Set default start and end nodes
    setStartNode(newGrid[15][5]);
    setEndNode(newGrid[15][44]);
    setGrid(newGrid);
  }, []);

  // Draw grid on canvas
  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || grid.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas with white background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw cells
    grid.forEach((row) => {
      row.forEach((node) => {
        const x = node.x * CELL_SIZE;
        const y = node.y * CELL_SIZE;

        // Determine cell color using actual hex values
        let color = "#FFFFFF"; // white for empty
        if (node.isStart) color = "#06B6D4"; // cyan
        else if (node.isEnd) color = "#C026D3"; // magenta
        else if (node.isPath) color = "#EAB308"; // yellow
        else if (node.isVisited) color = "#FB923C"; // coral/orange
        else if (node.isWall) color = "#334155"; // dark gray

        ctx.fillStyle = color;
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

        // Draw grid lines
        ctx.strokeStyle = "#E2E8F0";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);
      });
    });
  }, [grid]);

  useEffect(() => {
    drawGrid();
  }, [drawGrid]);

  // Handle mouse interactions
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isAnimating) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / CELL_SIZE);
    const y = Math.floor((e.clientY - rect.top) / CELL_SIZE);

    if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) return;

    const newGrid = grid.map((row) => row.map((node) => ({ ...node })));
    const clickedNode = newGrid[y][x];

    if (selectedTool === "start") {
      // Remove previous start
      if (startNode) {
        newGrid[startNode.y][startNode.x].isStart = false;
      }
      clickedNode.isStart = true;
      clickedNode.isWall = false;
      setStartNode(clickedNode);
    } else if (selectedTool === "end") {
      // Remove previous end
      if (endNode) {
        newGrid[endNode.y][endNode.x].isEnd = false;
      }
      clickedNode.isEnd = true;
      clickedNode.isWall = false;
      setEndNode(clickedNode);
    } else if (selectedTool === "wall") {
      if (!clickedNode.isStart && !clickedNode.isEnd) {
        clickedNode.isWall = !clickedNode.isWall;
      }
    }

    setGrid(newGrid);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedTool === "wall") {
      setIsDrawing(true);
      handleCanvasClick(e);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDrawing && selectedTool === "wall") {
      handleCanvasClick(e);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  // Manhattan distance heuristic
  const manhattanDistance = (a: GridNode, b: GridNode): number => {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  };

  // Get neighbors
  const getNeighbors = (node: GridNode, gridData: GridNode[][]): GridNode[] => {
    const neighbors: GridNode[] = [];
    const { x, y } = node;

    if (y > 0) neighbors.push(gridData[y - 1][x]); // Up
    if (y < GRID_ROWS - 1) neighbors.push(gridData[y + 1][x]); // Down
    if (x > 0) neighbors.push(gridData[y][x - 1]); // Left
    if (x < GRID_COLS - 1) neighbors.push(gridData[y][x + 1]); // Right

    return neighbors.filter((n) => !n.isWall);
  };

  // Reconstruct path
  const reconstructPath = (endNode: GridNode): GridNode[] => {
    const path: GridNode[] = [];
    let current: GridNode | null = endNode;
    while (current) {
      path.unshift(current);
      current = current.parent;
    }
    return path;
  };

  // Dijkstra's Algorithm
  const runDijkstra = async () => {
    if (!startNode || !endNode) {
      toast.error("Please place both start and end nodes!");
      return;
    }

    setIsAnimating(true);
    const visitedInOrder: GridNode[] = [];
    const newGrid = grid.map((row) =>
      row.map((node) => ({
        ...node,
        isVisited: false,
        isPath: false,
        gScore: Infinity,
        fScore: Infinity,
        parent: null,
      }))
    );

    const start = newGrid[startNode.y][startNode.x];
    start.gScore = 0;
    start.fScore = 0;

    const unvisited: GridNode[] = newGrid.flat();

    while (unvisited.length > 0) {
      // Sort by gScore (Dijkstra uses only gScore, no heuristic)
      unvisited.sort((a, b) => a.gScore - b.gScore);
      const current = unvisited.shift();

      if (!current || current.gScore === Infinity) break;

      if (current.isEnd) {
        // Found the end
        const path = reconstructPath(current);
        await animateAlgorithm(visitedInOrder, path, newGrid, "Dijkstra");
        return;
      }

      visitedInOrder.push(current);

      const neighbors = getNeighbors(current, newGrid);
      for (const neighbor of neighbors) {
        const tentativeGScore = current.gScore + 1;
        if (tentativeGScore < neighbor.gScore) {
          neighbor.gScore = tentativeGScore;
          neighbor.fScore = tentativeGScore;
          neighbor.parent = current;
        }
      }
    }

    toast.error("No path found!");
    setIsAnimating(false);
  };

  // A* Algorithm
  const runAStar = async () => {
    if (!startNode || !endNode) {
      toast.error("Please place both start and end nodes!");
      return;
    }

    setIsAnimating(true);
    const visitedInOrder: GridNode[] = [];
    const newGrid = grid.map((row) =>
      row.map((node) => ({
        ...node,
        isVisited: false,
        isPath: false,
        gScore: Infinity,
        hScore: 0,
        fScore: Infinity,
        parent: null,
      }))
    );

    const start = newGrid[startNode.y][startNode.x];
    const end = newGrid[endNode.y][endNode.x];
    start.gScore = 0;
    start.hScore = manhattanDistance(start, end);
    start.fScore = start.hScore;

    const openSet: GridNode[] = [start];
    const closedSet = new Set<GridNode>();

    while (openSet.length > 0) {
      // Sort by fScore
      openSet.sort((a, b) => a.fScore - b.fScore);
      const current = openSet.shift()!;

      if (current.isEnd) {
        // Found the end
        const path = reconstructPath(current);
        await animateAlgorithm(visitedInOrder, path, newGrid, "A*");
        return;
      }

      closedSet.add(current);
      visitedInOrder.push(current);

      const neighbors = getNeighbors(current, newGrid);
      for (const neighbor of neighbors) {
        if (closedSet.has(neighbor)) continue;

        const tentativeGScore = current.gScore + 1;

        if (!openSet.includes(neighbor)) {
          openSet.push(neighbor);
        } else if (tentativeGScore >= neighbor.gScore) {
          continue;
        }

        neighbor.parent = current;
        neighbor.gScore = tentativeGScore;
        neighbor.hScore = manhattanDistance(neighbor, end);
        neighbor.fScore = neighbor.gScore + neighbor.hScore;
      }
    }

    toast.error("No path found!");
    setIsAnimating(false);
  };

  // Animate the algorithm
  const animateAlgorithm = async (
    visited: GridNode[],
    path: GridNode[],
    gridData: GridNode[][],
    algorithmName: string
  ) => {
    // Animate visited nodes
    for (let i = 0; i < visited.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, ANIMATION_SPEED));
      const node = visited[i];
      if (!node.isStart && !node.isEnd) {
        gridData[node.y][node.x].isVisited = true;
      }
      setGrid([...gridData]);
    }

    // Animate path
    for (let i = 0; i < path.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, ANIMATION_SPEED * 2));
      const node = path[i];
      if (!node.isStart && !node.isEnd) {
        gridData[node.y][node.x].isPath = true;
      }
      setGrid([...gridData]);
    }

    setStats({
      algorithm: algorithmName,
      nodesExplored: visited.length,
      pathLength: path.length,
    });

    setIsAnimating(false);
    toast.success(`${algorithmName} completed!`);
  };

  // Reset grid (keep walls)
  const resetGrid = () => {
    const newGrid = grid.map((row) =>
      row.map((node) => ({
        ...node,
        isVisited: false,
        isPath: false,
        gScore: Infinity,
        hScore: 0,
        fScore: Infinity,
        parent: null,
      }))
    );
    setGrid(newGrid);
    setStats({
      algorithm: "---",
      nodesExplored: 0,
      pathLength: 0,
    });
  };

  // Clear all
  const clearAll = () => {
    const newGrid = grid.map((row) =>
      row.map((node) => ({
        ...node,
        isWall: false,
        isVisited: false,
        isPath: false,
        isStart: false,
        isEnd: false,
        gScore: Infinity,
        hScore: 0,
        fScore: Infinity,
        parent: null,
      }))
    );
    setGrid(newGrid);
    setStartNode(null);
    setEndNode(null);
    setStats({
      algorithm: "---",
      nodesExplored: 0,
      pathLength: 0,
    });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Shortest Path Visualizer
          </h1>
          <p className="text-muted-foreground text-lg">
            Compare Dijkstra's Algorithm vs A* Algorithm
          </p>
        </div>

        <div className="grid lg:grid-cols-[300px_1fr] gap-6">
          {/* Control Panel */}
          <Card className="p-6 h-fit space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">Algorithms</h2>
              <div className="space-y-2">
                <Button
                  onClick={runDijkstra}
                  disabled={isAnimating}
                  className="w-full"
                  variant="default"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Run Dijkstra
                </Button>
                <Button
                  onClick={runAStar}
                  disabled={isAnimating}
                  className="w-full"
                  variant="default"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Run A*
                </Button>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-4">Tools</h2>
              <div className="space-y-2">
                <Button
                  onClick={() => setSelectedTool("start")}
                  variant={selectedTool === "start" ? "default" : "outline"}
                  className="w-full justify-start"
                >
                  <MousePointer className="mr-2 h-4 w-4" />
                  Place Start Node
                </Button>
                <Button
                  onClick={() => setSelectedTool("end")}
                  variant={selectedTool === "end" ? "default" : "outline"}
                  className="w-full justify-start"
                >
                  <Flag className="mr-2 h-4 w-4" />
                  Place End Node
                </Button>
                <Button
                  onClick={() => setSelectedTool("wall")}
                  variant={selectedTool === "wall" ? "default" : "outline"}
                  className="w-full justify-start"
                >
                  <Square className="mr-2 h-4 w-4" />
                  Draw Walls
                </Button>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-4">Actions</h2>
              <div className="space-y-2">
                <Button
                  onClick={resetGrid}
                  disabled={isAnimating}
                  variant="outline"
                  className="w-full justify-start"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset Grid
                </Button>
                <Button
                  onClick={clearAll}
                  disabled={isAnimating}
                  variant="outline"
                  className="w-full justify-start"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear All
                </Button>
              </div>
            </div>

            {/* Stats Panel */}
            <Card className="p-4 bg-secondary">
              <h2 className="text-lg font-semibold mb-3">Statistics</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Algorithm:</span>
                  <span className="font-medium">{stats.algorithm}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nodes Explored:</span>
                  <span className="font-medium">{stats.nodesExplored}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Path Length:</span>
                  <span className="font-medium">{stats.pathLength}</span>
                </div>
              </div>
            </Card>

            {/* Legend */}
            <div>
              <h2 className="text-lg font-semibold mb-3">Legend</h2>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: "#06B6D4" }} />
                  <span>Start Node</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: "#C026D3" }} />
                  <span>End Node</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: "#334155" }} />
                  <span>Wall</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: "#FB923C" }} />
                  <span>Visited</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: "#EAB308" }} />
                  <span>Final Path</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Canvas Area */}
          <Card className="p-6">
            <canvas
              ref={canvasRef}
              width={GRID_COLS * CELL_SIZE}
              height={GRID_ROWS * CELL_SIZE}
              onClick={handleCanvasClick}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="border border-border rounded-lg cursor-crosshair shadow-lg mx-auto"
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

