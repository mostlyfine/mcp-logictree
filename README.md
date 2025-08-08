# Logic Tree MCP Server

An advanced MCP server implementation for hierarchical problem analysis using logic trees with sophisticated analytical capabilities. This server enables structured thinking through visual tree representations that break down complex problems into manageable, interconnected components while providing MECE validation, hypothesis generation, and feasibility assessment.

## Features

### Core Capabilities
- **Hierarchical problem decomposition** with rich metadata support
- **MECE validation** (Mutually Exclusive, Collectively Exhaustive) with overlap detection
- **Hypothesis generation** and reasoning support for evidence-based analysis
- **Feasibility assessment** with actionability scoring for solutions
- **Gap analysis** to identify missing causes, effects, or solutions
- **Confidence and priority tracking** with evidence-based reasoning

### Tree Operations
- Multiple node types (problem, cause, effect, solution, decision, option)
- Advanced node creation with confidence, priority, feasibility, evidence, and assumptions
- Tree operations (add, remove, move, update nodes)
- Visual tree representation with colored nodes and metadata display
- Comprehensive tree analysis with recommendations

### AI Guidance Features
- Smart workflow guidance with next-step recommendations
- Quick analysis optimized for AI consumption
- Current status assessment with contextual suggestions
- Automatic recommendation generation based on tree state

### Analysis Features
- Root cause analysis with hypothesis testing
- Decision tree support with feasibility scoring
- MECE validation and gap analysis
- Logic validation and consistency checking
- Action planning with concrete step identification

## Tool

### logictree

Facilitates hierarchical problem analysis through structured logic trees.

**🚀 AI Guidance Operations (START HERE):**
- `get_status`: Get current tree status with AI guidance and next steps
- `next_steps`: Get detailed workflow recommendations with specific actions
- `quick_analysis`: Get focused analysis results optimized for AI consumption

**📝 Basic Operations:**
- `add_node`: Create a new node with optional metadata (confidence, priority, feasibility, evidence, assumptions, tags)
- `remove_node`: Delete a node and all its children
- `move_node`: Change a node's parent to restructure the tree
- `update_node`: Modify existing node content or metadata
- `visualize_tree`: Display the complete tree structure with metadata

**🔍 Advanced Analysis Operations:**
- `analyze_tree`: Get comprehensive tree analysis with MECE validation and recommendations
- `generate_hypotheses`: Generate testable hypotheses for a specific node
- `suggest_actions`: Get prioritized recommendations for improvement

**Node Types:**
- `problem`: The main issue or question to be addressed
- `cause`: Contributing factors or root causes
- `effect`: Consequences or outcomes
- `solution`: Proposed fixes or answers
- `decision`: Choice points or decision branches
- `option`: Available alternatives or choices

**Parameters:**
- `operation` (required): The action to perform
- `nodeId`: Target node identifier (for node-specific operations)
- `content`: Text content for new nodes (required for add_node)
- `nodeType`: Node category (required for add_node)
- `parentId`: Parent node for new nodes (optional for root)
- `newParentId`: New parent when moving nodes

**Enhanced Metadata Parameters (within `metadata` object):**
- `metadata.confidence`: Confidence level (0-1) in the node's validity
- `metadata.priority`: Priority level (1-5) for solutions and actions
- `metadata.feasibility`: Feasibility score (1-5) for solution implementation
- `metadata.evidence`: Array of supporting evidence or data sources
- `metadata.assumptions`: Array of underlying assumptions
- `metadata.tags`: Array of categorization tags for organization

## Usage Examples

### AI-Guided Workflow (Recommended)
```json
// 1. Start with status check (ALWAYS begin with this)
{"operation": "get_status"}
// Response includes: current state, AI guidance, suggested next operations

// 2. If tree is empty, AI will guide you to create root problem
{"operation": "add_node", "content": "Low website conversion rate", "nodeType": "problem"}

// 3. Check progress and get next steps
{"operation": "quick_analysis"}
// Response: focused insights, key findings, next actions, AI guidance

// 4. Get specific next step recommendations
{"operation": "next_steps"}
// Response: exact parameters to use, workflow guidance, reasoning
```

### Basic Problem Analysis
```json
// 1. Create root problem
{"operation": "add_node", "content": "Low website conversion rate", "nodeType": "problem"}

// 2. Add potential causes with metadata
{"operation": "add_node", "content": "Slow page load times", "nodeType": "cause", "parentId": "node_1", "metadata": {"confidence": 0.8, "evidence": ["Google Analytics shows 5s average load time", "User feedback mentions slow performance"]}}
{"operation": "add_node", "content": "Confusing navigation", "nodeType": "cause", "parentId": "node_1", "metadata": {"confidence": 0.6, "evidence": ["Heatmap data shows scattered clicks"]}}
{"operation": "add_node", "content": "Weak call-to-action", "nodeType": "cause", "parentId": "node_1", "metadata": {"confidence": 0.7}}

// 3. Add solutions with priority and feasibility
{"operation": "add_node", "content": "Optimize images and compress CSS/JS files by 30%", "nodeType": "solution", "parentId": "node_2", "metadata": {"priority": 5, "feasibility": 4, "assumptions": ["Development team has 2 weeks availability"]}}
{"operation": "add_node", "content": "Redesign main navigation menu with user testing", "nodeType": "solution", "parentId": "node_3", "metadata": {"priority": 3, "feasibility": 2}}

// 4. Get comprehensive analysis
{"operation": "analyze_tree"}

// 5. Generate hypotheses for testing
{"operation": "generate_hypotheses", "nodeId": "node_1"}

// 6. Get action recommendations
{"operation": "suggest_actions"}
```

### Advanced Analysis Workflow
```json
// 1. Create decision point with assumptions
{"operation": "add_node", "content": "Choose marketing channel for Q1 campaign", "nodeType": "decision", "metadata": {"assumptions": ["Budget limit of $50k", "Target audience is 25-45 professionals"]}}

// 2. Add options with feasibility scores
{"operation": "add_node", "content": "Social media advertising (LinkedIn/Facebook)", "nodeType": "option", "parentId": "node_1", "metadata": {"feasibility": 5, "priority": 4, "evidence": ["Previous campaign achieved 3.2% CTR"]}}
{"operation": "add_node", "content": "Email marketing to existing database", "nodeType": "option", "parentId": "node_1", "metadata": {"feasibility": 4, "priority": 3, "evidence": ["Database of 15k subscribers"]}}
{"operation": "add_node", "content": "Content marketing blog series", "nodeType": "option", "parentId": "node_1", "metadata": {"feasibility": 2, "priority": 2}}

// 3. Get action recommendations
{"operation": "suggest_actions"}

// 4. Comprehensive analysis
{"operation": "analyze_tree"}

// 5. Visualize the complete tree
{"operation": "visualize_tree"}
```

## Configuration

### Usage with Claude Desktop

Add this to your `claude_desktop_config.json`:

#### docker
```json
{
  "mcpServers": {
    "logictree": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "mostlyfine/mcp-logictree"
      ]
    }
  }
}
```

To disable logging of tree visualizations set env var: `DISABLE_TREE_LOGGING` to `true`.

### Usage with VS Code

For Docker installation:
```json
{
  "mcp": {
    "servers": {
      "logic-tree": {
        "command": "docker",
        "args": [
          "run",
          "--rm",
          "-i",
          "mostlyfine/mcp-logictree"
        ]
      }
    }
  }
}
```

## Building

### Local Development
```bash
npm install
npm run build
```

### Docker
```bash
docker build -t mostlyfine/mcp-logictree .
```

## Use Cases

### Business Analysis
- **Root Cause Analysis**: Break down problems with MECE validation and evidence tracking
- **Decision Making**: Structure choices with feasibility assessment and priority ranking
- **Strategic Planning**: Create hierarchical project breakdowns with actionability scoring
- **Risk Assessment**: Identify gaps and validate assumptions in risk analysis

### Problem Solving
- **Technical Troubleshooting**: Systematically analyze issues with hypothesis generation
- **Process Improvement**: Map current state problems and evaluate solution feasibility
- **Quality Analysis**: Structure quality issues with evidence-based cause identification
- **Systems Thinking**: Map complex relationships with confidence scoring

### Research and Analysis
- **Hypothesis Testing**: Generate testable hypotheses for research questions
- **Gap Analysis**: Identify missing elements in research or analysis
- **Evidence Organization**: Structure findings with confidence levels and supporting data
- **Recommendation Development**: Create actionable recommendations with priority scoring

### Project Management
- **Issue Resolution**: Structure project problems with feasibility-assessed solutions
- **Stakeholder Analysis**: Map stakeholder concerns with evidence and priority levels
- **Risk Management**: Analyze project risks with comprehensive cause-effect mapping
- **Decision Documentation**: Create evidence-based decision trees with clear rationale

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.
