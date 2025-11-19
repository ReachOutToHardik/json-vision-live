'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Copy, 
  Trash2, 
  Minimize2, 
  FileJson, 
  Search, 
  Check, 
  AlertCircle, 
  ChevronRight, 
  ChevronDown, 
  Braces, 
  Download,
  Play,
  Share2,
  Network,
  Move,
  Github,
  Twitter,
  Globe,
  Zap,
  Eye,
  Code2,
  Upload,
  Folder,
  Target,
  Instagram,
  InstagramIcon,
  Linkedin
} from 'lucide-react';

// --- UTILS: Graph Layout Logic ---

// Calculates the size (height) of a node based on its children to prevent overlap
const calculateTreeSize = (data: any): number => {
  if (data === null || typeof data !== 'object') return 1;
  
  const keys = Object.keys(data);
  if (keys.length === 0) return 1;

  let size = 0;
  keys.forEach(key => {
    const value = data[key];
    if (typeof value === 'object' && value !== null) {
      size += calculateTreeSize(value);
    } else {
      size += 1; // Primitive takes 1 unit of space
    }
  });
  return size;
};

interface GraphNode {
  id: string;
  type: 'array' | 'object';
  path: string;
  x: number;
  y: number;
  data: Record<string, any>;
  label: string;
  totalHeight: number;
}

interface GraphEdge {
  from: string;
  to: string;
  label: string;
}

interface GraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  height: number;
}

// Converts JSON to Nodes and Edges with coordinates
const processGraph = (data: any, path = '', depth = 0, startY = 0): GraphResult => {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  
  // If strictly primitive (shouldn't happen at root usually but handling it)
  if (typeof data !== 'object' || data === null) {
    return { nodes: [], edges: [], height: 1 };
  }

  const keys = Object.keys(data);
  const isArray = Array.isArray(data);
  
  // 1. Create the parent node (The Block)
  const nodeId = path || 'root';
  // Calculate total height of this subtree to center lines or position next siblings
  const myTreeHeight = calculateTreeSize(data); 
  
  const node: GraphNode = {
    id: nodeId,
    type: isArray ? 'array' : 'object',
    path: path,
    x: depth * 500 + 80, // Horizontal spacing + initial offset (increased from 350 to 500)
    y: startY * 120 + 80, // Vertical spacing units + initial offset (increased from 60 to 120)
    data: {},
    label: path.split('.').pop() || path.split('[').pop()?.replace(']', '') || 'Root',
    totalHeight: myTreeHeight 
  };

  let currentYCursor = startY;
  
  // 2. Process children keys
  keys.forEach((key) => {
    const value = data[key];
    const currentPath = path 
      ? (isArray ? `${path}[${key}]` : `${path}.${key}`) 
      : key;
      
    const isPrimitive = value === null || typeof value !== 'object';

    if (isPrimitive) {
      node.data[key] = value;
    } else {
      const childResult = processGraph(value, currentPath, depth + 1, currentYCursor);
      
      nodes.push(...childResult.nodes);
      edges.push(...childResult.edges);
      
      // Create edge from this key to the child node
      edges.push({
        from: nodeId,
        to: currentPath,
        label: key
      });

      currentYCursor += childResult.height + 1.2;
    }
  });

  const totalHeightUsed = Math.max(1, currentYCursor - startY);
  nodes.push(node);
  
  return { nodes, edges, height: totalHeightUsed };
};

// --- Components ---

interface GraphNodeProps {
  node: GraphNode;
  onCopyPath: (path: string) => void;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
}

const GraphNodeComponent: React.FC<GraphNodeProps> = ({ node, onCopyPath, onMouseDown }) => {
  const isArray = node.type === 'array';
  
  return (
    <div 
      className="absolute bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden hover:border-blue-500/50 transition-colors w-80 group cursor-grab active:cursor-grabbing z-10"
      style={{ 
        left: node.x, 
        top: node.y,
        transform: 'translate(0, 0)' // Handled by left/top now for easier dragging logic
      }}
      onClick={(e) => {
        e.stopPropagation();
        onCopyPath(node.path);
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onMouseDown(e, node.id);
      }}
    >
      {/* Header */}
      <div className={`px-4 py-3 text-sm font-bold uppercase tracking-wider flex justify-between items-center
        ${isArray ? 'bg-purple-900/30 text-purple-300' : 'bg-blue-900/30 text-blue-300'}
      `}>
        <div className="flex items-center truncate" title={node.path}>
          {isArray ? <Braces size={16} className="mr-2" /> : <Network size={16} className="mr-2" />}
          <span className="truncate max-w-[180px]">{node.label}</span>
        </div>
        <div className="flex items-center space-x-2">
           <Move size={12} className="text-slate-500 opacity-50" />
           <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-slate-950 px-1 rounded text-slate-500">
            Copy Path
          </span>
        </div>
      </div>

      {/* Body (Primitives) */}
      <div className="p-3 space-y-1.5">
        {Object.keys(node.data).length === 0 ? (
          <div className="text-slate-600 text-sm italic px-1">Contains objects...</div>
        ) : (
          Object.entries(node.data).map(([k, v]) => (
            <div key={k} className="flex items-start text-sm font-mono border-b border-slate-800/50 last:border-0 pb-1.5 mb-1.5 last:pb-0 last:mb-0">
              <span className="text-slate-400 mr-2 shrink-0">{k}:</span>
              <span className="text-emerald-400 break-all truncate line-clamp-2">
                {v === null ? 'null' : v.toString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

interface GraphEdgeProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  label: string;
}

const GraphEdge: React.FC<GraphEdgeProps> = ({ startX, startY, endX, endY, label }) => {
  // Bezier curve logic
  // Start point is right side of parent
  const sX = startX + 320; // Node width (increased from 256 to 320)
  const sY = startY + 28; // Middle of header approx (increased from 20 to 28)
  
  // End point is left side of child
  const eX = endX;
  const eY = endY + 28; // Middle of header (increased from 20 to 28)

  // Control points for smooth curve
  const c1x = sX + (eX - sX) / 2;
  const c1y = sY;
  const c2x = eX - (eX - sX) / 2;
  const c2y = eY;

  const pathData = `M ${sX} ${sY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${eX} ${eY}`;

  return (
    <g>
      <path 
        d={pathData} 
        fill="none" 
        stroke="#334155" 
        strokeWidth="3" 
        className="opacity-50 transition-all duration-75"
      />
      {/* Label on the line */}
      <rect 
        x={(sX + eX) / 2 - (label.length * 4 + 12)} 
        y={(sY + eY) / 2 - 12} 
        width={label.length * 8 + 24} 
        height={24} 
        rx={6} 
        fill="#0f172a" 
        className="stroke-slate-800"
        strokeWidth={1.5}
      />
      <text 
        x={(sX + eX) / 2} 
        y={(sY + eY) / 2 + 5} 
        fill="#94a3b8" 
        textAnchor="middle" 
        fontSize="12"
        fontFamily="monospace"
        fontWeight="500"
      >
        {label}
      </text>
    </g>
  );
};

// 1. The Recursive Node Component for the Tree View
interface JsonNodeProps {
  itemKey?: string | number;
  value: any;
  isLast: boolean;
  path?: string;
  searchTerm?: string;
  onCopyPath: (path: string) => void;
}

const JsonNode: React.FC<JsonNodeProps> = ({ 
  itemKey, 
  value, 
  isLast, 
  path = '', 
  searchTerm = '', 
  onCopyPath 
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isPrimitive = !isObject && !isArray;

  const currentPath = path 
    ? (Number.isInteger(itemKey) ? `${path}[${itemKey}]` : `${path}.${itemKey}`) 
    : String(itemKey || '');

  const matchesSearch = (val: any, term: string) => {
    if (!term) return true;
    const s = JSON.stringify(val).toLowerCase();
    const t = term.toLowerCase();
    return s.includes(t);
  };

  if (searchTerm && !matchesSearch(value, searchTerm) && !matchesSearch(itemKey, searchTerm)) {
    return null;
  }

  const handleCopyPath = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopyPath(currentPath);
  };

  if (isPrimitive) {
    let displayValue: string = String(value);
    let valueColor = 'text-emerald-400'; 
    if (typeof value === 'number') valueColor = 'text-blue-400';
    if (typeof value === 'boolean') {
      valueColor = 'text-purple-400';
      displayValue = value.toString();
    }
    if (value === null) {
      valueColor = 'text-gray-500';
      displayValue = 'null';
    }
    if (typeof value === 'string') {
      displayValue = `"${value}"`;
    }

    return (
      <div 
        className={`group flex items-center font-mono text-sm hover:bg-slate-800/50 rounded px-1 py-0.5 cursor-pointer transition-colors`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleCopyPath}
      >
        {itemKey !== undefined && (
          <span className="text-slate-400 mr-2 opacity-90">{itemKey}:</span>
        )}
        <span className={`${valueColor} break-all`}>{displayValue}</span>
        {!isLast && <span className="text-slate-500">,</span>}
        
        {isHovered && (
          <span className="ml-2 text-xs text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
            Click to copy path
          </span>
        )}
      </div>
    );
  }

  const keys = Object.keys(value);
  const brackets = isArray ? ['[', ']'] : ['{', '}'];

  return (
    <div className="font-mono text-sm">
      <div 
        className="flex items-center hover:bg-slate-800/50 rounded px-1 py-0.5 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <button className="mr-1 text-slate-500 hover:text-white transition-colors">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        
        {itemKey !== undefined && (
          <span className="text-slate-300 mr-2 font-semibold">{itemKey}:</span>
        )}
        
        <span className="text-yellow-500 font-bold">{brackets[0]}</span>
        
        {!isExpanded && (
          <span className="text-slate-500 mx-2 text-xs italic">
             {isArray ? `${keys.length} items` : `${keys.length} keys`} 
          </span>
        )}

        {!isExpanded && (
          <>
            <span className="text-yellow-500 font-bold">{brackets[1]}</span>
            {!isLast && <span className="text-slate-500">,</span>}
          </>
        )}
      </div>

      {isExpanded && (
        <div className="pl-4 border-l border-slate-700/50 ml-2.5">
          {keys.map((key, idx) => (
            <JsonNode
              key={key}
              itemKey={isArray ? parseInt(key) : key}
              value={value[key]}
              isLast={idx === keys.length - 1}
              path={currentPath}
              searchTerm={searchTerm}
              onCopyPath={onCopyPath}
            />
          ))}
        </div>
      )}
      
      {isExpanded && (
        <div className="pl-1">
          <span className="text-yellow-500 font-bold">{brackets[1]}</span>
          {!isLast && <span className="text-slate-500">,</span>}
        </div>
      )}
    </div>
  );
};

// 2. Main Application Component
export default function JsonVisualizer() {
  const defaultJson = {
    "project": "Vercel Micro-SaaS",
    "active": true,
    "stats": {
      "visitors": 1204,
      "revenue": 450.50,
      "growth": null
    },
    "team": {
      "leads": ["Alex", "Sam"],
      "devs": ["Jordan", "Casey", "Taylor"]
    },
    "tags": ["dev", "tools", "react"],
    "features": [
      { "id": 1, "name": "Visualizer", "status": "done" },
      { "id": 2, "name": "Path Finder", "status": "pending" },
      { "id": 3, "name": "Graph View", "status": "new", "details": { "complexity": "high" } }
    ]
  };

  const [input, setInput] = useState(JSON.stringify(defaultJson, null, 2));
  const [parsedData, setParsedData] = useState<any>(defaultJson);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState<{msg: string; isError?: boolean} | null>(null);
  const [viewMode, setViewMode] = useState<'split' | 'editor' | 'visual' | 'graph'>('split');
  const [isDragging, setIsDragging] = useState(false);
  const [jsonPath, setJsonPath] = useState('');
  const [jsonPathResult, setJsonPathResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Graph Data State
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });

  // --- Movement State ---
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const itemStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    try {
      if (!input.trim()) {
        setParsedData(null);
        setError(null);
        return;
      }
      const parsed = JSON.parse(input);
      setParsedData(parsed);
      setError(null);
      
      // Generate graph data when valid JSON exists
      // Only regenerate if we are NOT currently dragging nodes (to prevent reset while moving)
      if (parsed && !draggedNodeId) {
        const { nodes, edges } = processGraph(parsed);
        setGraphData({ nodes, edges });
      }
    } catch (err: any) {
      setError(err.message);
    }
  }, [input]); // Dependencies technically include draggedNodeId but logic handles it

  // --- Drag Handlers ---

  const handleMouseDown = (e: React.MouseEvent, nodeId: string | null = null) => {
    // Only trigger for left click
    if (e.button !== 0) return;

    e.preventDefault();
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    
    if (nodeId) {
      setDraggedNodeId(nodeId);
      const node = graphData.nodes.find(n => n.id === nodeId);
      if (node) {
        itemStartRef.current = { x: node.x, y: node.y };
      }
    } else {
      setIsDraggingCanvas(true);
      itemStartRef.current = { x: pan.x, y: pan.y };
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDraggingCanvas) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPan({ x: itemStartRef.current.x + dx, y: itemStartRef.current.y + dy });
    } else if (draggedNodeId) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      
      setGraphData(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => 
          n.id === draggedNodeId 
            ? { ...n, x: itemStartRef.current.x + dx, y: itemStartRef.current.y + dy }
            : n
        )
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
    setDraggedNodeId(null);
  };

  // Global mouse up/move listener for smooth dragging outside container
  useEffect(() => {
    if (isDraggingCanvas || draggedNodeId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingCanvas, draggedNodeId, graphData.nodes, pan]);


  // --- Actions ---
  const handleFormat = () => {
    try {
      const parsed = JSON.parse(input);
      setInput(JSON.stringify(parsed, null, 2));
      showNotification("Formatted JSON");
    } catch (e) {
      showNotification("Cannot format: Invalid JSON", true);
    }
  };

  const handleMinify = () => {
    try {
      const parsed = JSON.parse(input);
      setInput(JSON.stringify(parsed));
      showNotification("Minified JSON");
    } catch (e) {
      showNotification("Cannot minify: Invalid JSON", true);
    }
  };

  const handleClear = () => {
    setInput('');
    setParsedData(null);
  };

  const handleCopyInput = () => {
    navigator.clipboard.writeText(input);
    showNotification("Raw JSON copied");
  };

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    showNotification(`Path copied: ${path}`);
  };

  const handleDownload = () => {
     const blob = new Blob([input], { type: "application/json" });
     const url = URL.createObjectURL(blob);
     const link = document.createElement('a');
     link.href = url;
     link.download = "data.json";
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
     showNotification("Downloaded data.json");
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setInput(content);
      showNotification(`Loaded ${file.name}`);
    };
    reader.onerror = () => {
      showNotification("Failed to read file", true);
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        handleFileUpload(file);
      } else {
        showNotification("Please drop a JSON file", true);
      }
    }
  };

  const handleBrowseFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const evaluateJSONPath = (path: string) => {
    if (!path.trim() || !parsedData) {
      setJsonPathResult(null);
      return;
    }

    try {
      // Simple JSONPath evaluation (supports basic paths like $.key.subkey or $[0].key)
      let result = parsedData;
      const parts = path.replace(/^\$\.?/, '').split(/\.|\[|\]/).filter(p => p);
      
      for (const part of parts) {
        if (result === null || result === undefined) break;
        result = result[part];
      }
      
      setJsonPathResult(result);
      showNotification(`JSONPath evaluated`);
    } catch (err) {
      setJsonPathResult(null);
      showNotification("Invalid JSONPath", true);
    }
  };

  const showNotification = (msg: string, isError = false) => {
    setNotification({ msg, isError });
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col font-sans">
      
      {/* --- Header --- */}
      <header className="bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between sticky top-0 z-20 shadow-md">
        <div className="flex items-center space-x-2">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Braces className="text-white" size={20} />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight text-white">JSON Vision</h1>
            <p className="text-xs text-slate-400">Visualize & Extract Paths</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* File Upload Controls */}
          <div className="hidden md:flex items-center space-x-2">
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".json,application/json"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <button 
              onClick={handleBrowseFile}
              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-md text-sm border border-slate-700 transition-colors"
              title="Browse Files"
            >
              <Folder size={14} />
              <span className="hidden lg:inline">Browse</span>
            </button>
          </div>

          {/* View Toggles */}
          <div className="hidden md:flex bg-slate-800 rounded-lg p-1 border border-slate-700">
            <button 
              onClick={() => setViewMode('editor')}
              className={`px-3 py-1 text-xs rounded-md transition-all ${viewMode === 'editor' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Raw
            </button>
            <button 
              onClick={() => setViewMode('split')}
              className={`px-3 py-1 text-xs rounded-md transition-all ${viewMode === 'split' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Split
            </button>
            <button 
              onClick={() => setViewMode('visual')}
              className={`px-3 py-1 text-xs rounded-md transition-all ${viewMode === 'visual' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Tree
            </button>
            <button 
              onClick={() => setViewMode('graph')}
              className={`px-3 py-1 text-xs rounded-md transition-all flex items-center space-x-1 ${viewMode === 'graph' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              <Share2 size={10} className="mr-1" />
              Graph
            </button>
          </div>

          <button 
            onClick={handleDownload}
            className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-1.5 rounded-md text-sm border border-blue-500/50 transition-all shadow-lg shadow-blue-500/20"
            title="Export JSON"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Export JSON</span>
          </button>
        </div>
      </header>

      {/* --- Main Content --- */}
      <main className="flex-1 flex overflow-hidden relative">
        
        {/* Left Panel: Input Editor */}
        <div className={`flex flex-col border-r border-slate-800 transition-all duration-300 
          ${(viewMode === 'visual' || viewMode === 'graph') ? 'w-0 overflow-hidden opacity-0' : viewMode === 'editor' ? 'w-full' : 'w-1/2'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        >
          
          {/* JSONPath Query Bar */}
          <div className="bg-slate-900/70 px-4 py-2 border-b border-slate-800 flex items-center space-x-2">
            <Target size={14} className="text-blue-400" />
            <input 
              type="text" 
              placeholder="JSONPath query (e.g., $.stats.visitors or $.features[0].name)" 
              value={jsonPath}
              onChange={(e) => setJsonPath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && evaluateJSONPath(jsonPath)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
            />
            <button 
              onClick={() => evaluateJSONPath(jsonPath)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors"
            >
              Query
            </button>
            {jsonPathResult !== null && (
              <div className="bg-slate-800 px-3 py-1.5 rounded text-xs font-mono text-emerald-400 max-w-xs truncate" title={JSON.stringify(jsonPathResult)}>
                {JSON.stringify(jsonPathResult)}
              </div>
            )}
          </div>

          <div className="bg-slate-900/50 p-2 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-2">Input</span>
            <div className="flex space-x-1">
              <button onClick={handleFormat} title="Format" className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-blue-400 transition-colors">
                <Play size={16} className="rotate-90" />
              </button>
              <button onClick={handleMinify} title="Minify" className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-blue-400 transition-colors">
                <Minimize2 size={16} />
              </button>
              <button onClick={handleCopyInput} title="Copy Raw" className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-emerald-400 transition-colors">
                <Copy size={16} />
              </button>
              <button onClick={handleClear} title="Clear" className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          <div className="relative flex-1">
            {/* Drag & Drop Overlay */}
            {isDragging && (
              <div className="absolute inset-0 bg-blue-950/90 backdrop-blur-sm z-50 flex items-center justify-center border-4 border-dashed border-blue-500 rounded-lg m-2">
                <div className="text-center">
                  <Upload size={48} className="mx-auto mb-4 text-blue-400 animate-bounce" />
                  <p className="text-xl font-bold text-white mb-2">Drop your JSON file here</p>
                  <p className="text-sm text-slate-300">Supports .json files</p>
                </div>
              </div>
            )}
            
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full h-full bg-slate-950 text-slate-300 font-mono text-sm p-4 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50 border-none"
              placeholder="Paste your JSON here..."
              spellCheck={false}
            />
            {error && (
              <div className="absolute bottom-4 left-4 right-4 bg-red-900/90 border border-red-700 text-red-200 px-4 py-3 rounded shadow-lg backdrop-blur-sm flex items-start space-x-3 animate-in fade-in slide-in-from-bottom-4">
                <AlertCircle className="shrink-0 mt-0.5" size={18} />
                <div className="text-sm">
                  <p className="font-bold">Invalid JSON</p>
                  <p className="opacity-90">{error}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Visualizer (Tree or Graph) */}
        <div className={`flex flex-col bg-slate-900/30 transition-all duration-300
          ${viewMode === 'editor' ? 'w-0 overflow-hidden opacity-0' : (viewMode === 'visual' || viewMode === 'graph') ? 'w-full' : 'w-1/2'}
        `}>
          
          {/* Toolbar */}
          <div className="bg-slate-900/50 p-2 border-b border-slate-800 flex items-center justify-between z-10">
             <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-2">
               {viewMode === 'graph' ? 'Graph Flow' : 'Tree View'}
             </span>
             {viewMode !== 'graph' && (
               <div className="relative group">
                  <Search className="absolute left-2 top-1.5 text-slate-500 group-focus-within:text-blue-400" size={14} />
                  <input 
                    type="text" 
                    placeholder="Filter nodes..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-md pl-8 pr-2 py-1 text-xs w-32 focus:w-48 transition-all focus:outline-none focus:border-blue-500 text-slate-200 placeholder-slate-600"
                  />
               </div>
             )}
             {viewMode === 'graph' && (
               <div className="text-xs text-slate-500 flex items-center space-x-2">
                  <span className="hidden lg:inline opacity-50 mr-2">Drag background to pan • Drag nodes to move</span>
                  <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-blue-500 mr-1"></span>Object</span>
                  <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-purple-500 mr-1"></span>Array</span>
               </div>
             )}
          </div>

          {/* Viewer Content */}
          <div className="flex-1 overflow-hidden bg-slate-950 relative">
            {!parsedData ? (
               <div className="h-full flex flex-col items-center justify-center text-slate-600">
                  <FileJson size={48} className="mb-4 opacity-50" />
                  <p className="text-sm">Enter valid JSON to visualize</p>
               </div>
            ) : viewMode === 'graph' ? (
              // --- GRAPH VIEW (Interactive) ---
              <div 
                className={`w-full h-full relative overflow-hidden ${isDraggingCanvas ? 'cursor-grabbing' : 'cursor-grab'}`}
                onMouseDown={(e) => handleMouseDown(e, null)}
              >
                {/* Watermark */}
                <div className="absolute bottom-6 right-6 z-50 pointer-events-none select-none">
                  <div className="flex items-center space-x-2 bg-slate-900/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-slate-700/50 shadow-xl">
                    <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-1.5 rounded">
                      <Braces className="text-white" size={16} />
                    </div>
                    <div className="text-sm">
                      <div className="font-bold text-white">JSON Vision</div>
                      <div className="text-[10px] text-slate-400">jsonvision.dev</div>
                    </div>
                  </div>
                </div>
                
                {/* Transform Layer */}
                <div 
                  style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
                  className="w-full h-full absolute top-0 left-0 transition-transform duration-75 ease-out will-change-transform"
                >
                  {/* Render SVG Edges Layer */}
                  <svg className="absolute top-0 left-0 w-[4000px] h-[4000px] pointer-events-none z-0 overflow-visible">
                    {graphData.edges.map((edge, idx) => {
                      const source = graphData.nodes.find(n => n.id === edge.from);
                      const target = graphData.nodes.find(n => n.id === edge.to);
                      if (!source || !target) return null;
                      return (
                        <GraphEdge 
                          key={idx} 
                          startX={source.x} 
                          startY={source.y} 
                          endX={target.x} 
                          endY={target.y}
                          label={edge.label}
                        />
                      );
                    })}
                  </svg>

                  {/* Render Nodes Layer */}
                  {graphData.nodes.map(node => (
                    <GraphNodeComponent 
                      key={node.id} 
                      node={node} 
                      onCopyPath={handleCopyPath} 
                      onMouseDown={handleMouseDown}
                    />
                  ))}
                </div>
              </div>
            ) : (
              // --- TREE VIEW ---
              <div className="p-4 overflow-auto h-full custom-scrollbar">
                <div className="bg-slate-900 rounded-lg p-4 border border-slate-800 shadow-inner min-h-full">
                  <JsonNode 
                    itemKey={undefined} 
                    value={parsedData} 
                    isLast={true} 
                    path="" 
                    searchTerm={searchTerm}
                    onCopyPath={handleCopyPath}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Notification Toast */}
      {notification && (
        <div className={`fixed bottom-6 right-6 px-4 py-2 rounded-lg shadow-xl backdrop-blur-md border flex items-center space-x-2 text-sm font-medium animate-in fade-in slide-in-from-bottom-2 z-50
          ${notification.isError ? 'bg-red-950/80 border-red-800 text-red-200' : 'bg-blue-950/80 border-blue-800 text-blue-200'}
        `}>
          {notification.isError ? <AlertCircle size={16} /> : <Check size={16} />}
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Footer */}
      <footer className={`bg-slate-900 border-t border-slate-800 mt-auto transition-all duration-300 ${viewMode === 'graph' ? 'hidden' : ''}`}>
        {/* Stats Bar */}
        <div className="bg-gradient-to-r from-blue-950/30 to-purple-950/30 border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div className="space-y-1">
                <div className="flex items-center justify-center space-x-2 text-blue-400">
                  <Eye size={16} />
                  <span className="text-2xl font-bold">4</span>
                </div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">View Modes</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center space-x-2 text-purple-400">
                  <Zap size={16} />
                  <span className="text-2xl font-bold">Real-time</span>
                </div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">Validation</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center space-x-2 text-emerald-400">
                  <Code2 size={16} />
                  <span className="text-2xl font-bold">Free</span>
                </div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">& Open Source</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center space-x-2 text-orange-400">
                  <Network size={16} />
                  <span className="text-2xl font-bold">∞</span>
                </div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">JSON Size</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Footer Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            
            {/* Brand */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-2 rounded-lg">
                  <Braces className="text-white" size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-white">JSON Vision</h3>
                  <p className="text-xs text-slate-400">by Hardik Joshi</p>
                </div>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                A powerful, modern JSON visualization tool with interactive tree and graph views. Perfect for developers working with complex JSON structures.
              </p>
            </div>

            {/* Features */}
            <div>
              <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Features</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="hover:text-blue-400 transition-colors cursor-pointer flex items-center space-x-2">
                  <ChevronRight size={12} className="text-blue-500" />
                  <span>Tree View</span>
                </li>
                <li className="hover:text-blue-400 transition-colors cursor-pointer flex items-center space-x-2">
                  <ChevronRight size={12} className="text-blue-500" />
                  <span>Graph View</span>
                </li>
                <li className="hover:text-blue-400 transition-colors cursor-pointer flex items-center space-x-2">
                  <ChevronRight size={12} className="text-blue-500" />
                  <span>Path Extraction</span>
                </li>
                <li className="hover:text-blue-400 transition-colors cursor-pointer flex items-center space-x-2">
                  <ChevronRight size={12} className="text-blue-500" />
                  <span>Real-time Validation</span>
                </li>
                <li className="hover:text-blue-400 transition-colors cursor-pointer flex items-center space-x-2">
                  <ChevronRight size={12} className="text-blue-500" />
                  <span>Search & Filter</span>
                </li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Resources</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="hover:text-blue-400 transition-colors cursor-pointer flex items-center space-x-2">
                  <ChevronRight size={12} className="text-purple-500" />
                  <span>Documentation</span>
                </li>
                <li className="hover:text-blue-400 transition-colors cursor-pointer flex items-center space-x-2">
                  <ChevronRight size={12} className="text-purple-500" />
                  <span>API Reference</span>
                </li>
                <li className="hover:text-blue-400 transition-colors cursor-pointer flex items-center space-x-2">
                  <ChevronRight size={12} className="text-purple-500" />
                  <span>Tutorial</span>
                </li>
                <li className="hover:text-blue-400 transition-colors cursor-pointer flex items-center space-x-2">
                  <ChevronRight size={12} className="text-purple-500" />
                  <span>Examples</span>
                </li>
                <li className="hover:text-blue-400 transition-colors cursor-pointer flex items-center space-x-2">
                  <ChevronRight size={12} className="text-purple-500" />
                  <span>Changelog</span>
                </li>
              </ul>
            </div>

            {/* Connect */}
            <div>
              <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Connect</h4>
              <div className="space-y-4">
                <div className="flex space-x-3">
                  <a href="https://github.com/ReachOutToHardik" target='_blank' className="bg-slate-800 hover:bg-blue-600 p-2 rounded-lg transition-colors group" title="GitHub">
                    <Github size={18} className="text-slate-400 group-hover:text-white" />
                  </a>
                  <a href="https://instagram.com/hardik_joshi14" target='_blank' className="bg-slate-800 hover:bg-blue-500 p-2 rounded-lg transition-colors group" title="Twitter">
                    <Instagram size={18} className="text-slate-400 group-hover:text-white" />
                  </a>
                  <a href="https://linkedin.com/in/reachouttohardik" target='_blank' className="bg-slate-800 hover:bg-purple-600 p-2 rounded-lg transition-colors group" title="Website">
                    <Linkedin size={18} className="text-slate-400 group-hover:text-white" />
                  </a>
                </div>
                <div className="text-sm text-slate-400 space-y-1">
                  <p>📧 cloud1inthesky@gmail.com</p>
                  <p>💬 Join our Discord</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <div className="flex items-center space-x-4 text-sm text-slate-400">
                <span>© 2025 JSON Vision. All rights reserved.</span>
                <span className="hidden md:inline">•</span>
                <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent font-semibold">Made with ❤️ by Hardik Joshi</span>
              </div>
              <div className="flex items-center space-x-6 text-sm text-slate-400">
                <a href="#" className="hover:text-blue-400 transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-blue-400 transition-colors">Terms of Service</a>
                <a href="#" className="hover:text-blue-400 transition-colors">License</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
