#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import chalk from 'chalk';

interface LogicTreeNode {
  id: string;
  content: string;
  type: 'problem' | 'cause' | 'effect' | 'solution' | 'decision' | 'option';
  parentId?: string;
  children: string[];
  level: number;
  expanded: boolean;
  confidence?: number; // Confidence level (0-1)
  priority?: number; // Priority level (1-5)
  feasibility?: number; // Feasibility score (1-5)
  evidence?: string[]; // Supporting evidence
  assumptions?: string[]; // Underlying assumptions
  tags?: string[]; // Categorization tags
  createdAt: Date;
  updatedAt: Date;
}

interface LogicTreeData {
  operation: 'add_node' | 'remove_node' | 'move_node' | 'update_node' | 'visualize_tree' | 'analyze_tree' | 'generate_hypotheses' | 'suggest_actions' | 'get_status' | 'next_steps' | 'quick_analysis';
  nodeId?: string;
  content?: string;
  nodeType?: 'problem' | 'cause' | 'effect' | 'solution' | 'decision' | 'option';
  parentId?: string;
  newParentId?: string;
  metadata?: {
    confidence?: number;
    priority?: number;
    feasibility?: number;
    evidence?: string[];
    assumptions?: string[];
    tags?: string[];
  };
}

class LogicTreeServer {
  private nodes: Map<string, LogicTreeNode> = new Map();
  private rootNodeId?: string;
  private nextId = 1;
  private disableTreeLogging: boolean;

  constructor() {
    this.disableTreeLogging = (process.env.DISABLE_TREE_LOGGING || "").toLowerCase() === "true";
  }

  private generateId(): string {
    return `node_${this.nextId++}`;
  }

  private validateTreeData(input: unknown): LogicTreeData {
    const data = input as Record<string, unknown>;

    if (!data.operation || typeof data.operation !== 'string') {
      throw new Error('Invalid operation: must be a string');
    }

    const validOperations = ['add_node', 'remove_node', 'move_node', 'update_node', 'visualize_tree', 'analyze_tree', 'generate_hypotheses', 'suggest_actions', 'get_status', 'next_steps', 'quick_analysis'];
    if (!validOperations.includes(data.operation)) {
      throw new Error(`Invalid operation: must be one of ${validOperations.join(', ')}`);
    }

    return {
      operation: data.operation as LogicTreeData['operation'],
      nodeId: data.nodeId as string | undefined,
      content: data.content as string | undefined,
      nodeType: data.nodeType as LogicTreeNode['type'] | undefined,
      parentId: data.parentId as string | undefined,
      newParentId: data.newParentId as string | undefined,
      metadata: data.metadata as LogicTreeData['metadata'] | undefined,
    };
  }

  private addNode(content: string, nodeType: LogicTreeNode['type'], parentId?: string, options?: {
    confidence?: number;
    priority?: number;
    feasibility?: number;
    evidence?: string[];
    assumptions?: string[];
    tags?: string[];
  }): LogicTreeNode {
    const id = this.generateId();
    const level = parentId ? (this.nodes.get(parentId)?.level || 0) + 1 : 0;
    const now = new Date();

    const node: LogicTreeNode = {
      id,
      content,
      type: nodeType,
      parentId,
      children: [],
      level,
      expanded: true,
      confidence: options?.confidence,
      priority: options?.priority,
      feasibility: options?.feasibility,
      evidence: options?.evidence || [],
      assumptions: options?.assumptions || [],
      tags: options?.tags || [],
      createdAt: now,
      updatedAt: now
    };

    this.nodes.set(id, node);

    if (parentId) {
      const parent = this.nodes.get(parentId);
      if (parent) {
        parent.children.push(id);
      }
    } else {
      this.rootNodeId = id;
    }

    return node;
  }

  private removeNode(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    // Remove from parent's children
    if (node.parentId) {
      const parent = this.nodes.get(node.parentId);
      if (parent) {
        parent.children = parent.children.filter(id => id !== nodeId);
      }
    }

    // Remove all children recursively
    node.children.forEach(childId => this.removeNode(childId));

    // Remove the node itself
    this.nodes.delete(nodeId);

    if (this.rootNodeId === nodeId) {
      this.rootNodeId = undefined;
    }

    return true;
  }

  private moveNode(nodeId: string, newParentId?: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    // Remove from current parent
    if (node.parentId) {
      const oldParent = this.nodes.get(node.parentId);
      if (oldParent) {
        oldParent.children = oldParent.children.filter(id => id !== nodeId);
      }
    }

    // Add to new parent
    if (newParentId) {
      const newParent = this.nodes.get(newParentId);
      if (!newParent) return false;
      newParent.children.push(nodeId);
      node.parentId = newParentId;
      node.level = newParent.level + 1;
    } else {
      node.parentId = undefined;
      node.level = 0;
      this.rootNodeId = nodeId;
    }

    // Update levels for all children
    this.updateChildrenLevels(node);

    return true;
  }

  private updateNode(nodeId: string, content: string, metadata?: {
    confidence?: number;
    priority?: number;
    feasibility?: number;
    evidence?: string[];
    assumptions?: string[];
    tags?: string[];
  }): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    node.content = content;
    node.updatedAt = new Date();

    if (metadata) {
      node.confidence = metadata.confidence;
      node.priority = metadata.priority;
      node.feasibility = metadata.feasibility;
      node.evidence = metadata.evidence;
      node.assumptions = metadata.assumptions;
      node.tags = metadata.tags;
    }

    return true;
  }

  private updateChildrenLevels(node: LogicTreeNode): void {
    node.children.forEach(childId => {
      const child = this.nodes.get(childId);
      if (child) {
        child.level = node.level + 1;
        this.updateChildrenLevels(child);
      }
    });
  }

  // 共通ヘルパーメソッド: ノードの統計情報を計算
  private calculateNodeStatistics(): {
    totalNodes: number;
    nodesByType: Record<string, number>;
    nodesByLevel: Record<number, number>;
    maxDepth: number;
  } {
    const totalNodes = this.nodes.size;
    const nodesByType: Record<string, number> = {};
    const nodesByLevel: Record<number, number> = {};
    let maxDepth = 0;

    this.nodes.forEach(node => {
      nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
      nodesByLevel[node.level] = (nodesByLevel[node.level] || 0) + 1;
      maxDepth = Math.max(maxDepth, node.level);
    });

    return {
      totalNodes,
      nodesByType,
      nodesByLevel,
      maxDepth
    };
  }

  private toggleNodeExpansion(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;
    node.expanded = !node.expanded;
    return true;
  }

  private visualizeTree(): string {
    if (!this.rootNodeId) {
      return "Empty tree";
    }

    const lines: string[] = [];
    this.visualizeNode(this.rootNodeId, "", true, lines);
    return lines.join("\n");
  }

  private visualizeNode(nodeId: string, prefix: string, isLast: boolean, lines: string[]): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    const typeColors = {
      problem: chalk.red,
      cause: chalk.yellow,
      effect: chalk.magenta,
      solution: chalk.green,
      decision: chalk.blue,
      option: chalk.cyan
    };

    const typeSymbols = {
      problem: "❗",
      cause: "⚠️",
      effect: "📊",
      solution: "✅",
      decision: "🤔",
      option: "🔗"
    };

    const connector = isLast ? "└── " : "├── ";
    const content = typeColors[node.type](`${typeSymbols[node.type]} [${node.type.toUpperCase()}] ${node.content}`);
    lines.push(prefix + connector + content);

    if (node.expanded && node.children.length > 0) {
      const childPrefix = prefix + (isLast ? "    " : "│   ");
      node.children.forEach((childId, index) => {
        const isLastChild = index === node.children.length - 1;
        this.visualizeNode(childId, childPrefix, isLastChild, lines);
      });
    } else if (!node.expanded && node.children.length > 0) {
      const childPrefix = prefix + (isLast ? "    " : "│   ");
      lines.push(childPrefix + chalk.gray(`... (${node.children.length} collapsed children)`));
    }
  }

  private analyzeTree(): object {
    const stats = this.calculateNodeStatistics();
    const meceAnalysis = this.validateMECE();
    const gapAnalysis = this.findGaps();
    const feasibilityAnalysis = this.assessOverallFeasibility();

    return {
      totalNodes: stats.totalNodes,
      maxDepth: stats.maxDepth + 1,
      nodesByType: stats.nodesByType,
      nodesByLevel: stats.nodesByLevel,
      hasRoot: !!this.rootNodeId,
      rootNodeId: this.rootNodeId,
      meceAnalysis,
      gapAnalysis,
      feasibilityAnalysis,
      recommendations: this.generateRecommendations()
    };
  }

  private getNodeDetails(nodeId: string): LogicTreeNode | null {
    return this.nodes.get(nodeId) || null;
  }

  private getTreeStructure(): Record<string, LogicTreeNode> {
    const structure: Record<string, LogicTreeNode> = {};
    this.nodes.forEach((node, id) => {
      structure[id] = { ...node };
    });
    return structure;
  }

  // MECE validation functionality
  private validateMECE(): {
    isComplete: boolean;
    hasOverlaps: boolean;
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let hasOverlaps = false;

    // Check for overlaps between sibling nodes
    this.nodes.forEach(parent => {
      if (parent.children.length > 1) {
        const children = parent.children.map(id => this.nodes.get(id)!);

        // Check content similarity
        for (let i = 0; i < children.length; i++) {
          for (let j = i + 1; j < children.length; j++) {
            if (this.calculateSimilarity(children[i].content, children[j].content) > 0.7) {
              hasOverlaps = true;
              issues.push(`Potential overlap: "${children[i].content}" and "${children[j].content}"`);
            }
          }
        }

        // Check completeness for problem decomposition
        if (children.length < 3 && parent.type === 'problem') {
          suggestions.push(`Problem "${parent.content}" decomposition may need more detail`);
        }
      }
    });

    return {
      isComplete: issues.length === 0,
      hasOverlaps,
      issues,
      suggestions
    };
  }

  // Text similarity calculation (simplified version)
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    const commonWords = words1.filter(word => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  // Find logical gaps
  private findGaps(): {
    missingCauses: string[];
    missingEffects: string[];
    missingSolutions: string[];
    recommendations: string[];
  } {
    const gaps = {
      missingCauses: [] as string[],
      missingEffects: [] as string[],
      missingSolutions: [] as string[],
      recommendations: [] as string[]
    };

    this.nodes.forEach(node => {
      switch (node.type) {
        case 'problem':
          if (node.children.filter(id => this.nodes.get(id)?.type === 'cause').length === 0) {
            gaps.missingCauses.push(`Problem "${node.content}" lacks cause analysis`);
          }
          if (node.children.filter(id => this.nodes.get(id)?.type === 'solution').length === 0) {
            gaps.missingSolutions.push(`Problem "${node.content}" lacks solutions`);
          }
          break;
        case 'cause':
          if (node.children.filter(id => this.nodes.get(id)?.type === 'solution').length === 0) {
            gaps.recommendations.push(`Consider specific countermeasures for cause "${node.content}"`);
          }
          break;
      }
    });

    return gaps;
  }

  // Overall feasibility assessment
  private assessOverallFeasibility(): {
    averageFeasibility: number;
    highPriorityItems: LogicTreeNode[];
    lowFeasibilityItems: LogicTreeNode[];
    recommendations: string[];
  } {
    const solutionNodes = Array.from(this.nodes.values()).filter(node => node.type === 'solution');
    const feasibilityScores = solutionNodes
      .map(node => node.feasibility)
      .filter(score => score !== undefined) as number[];

    const averageFeasibility = feasibilityScores.length > 0
      ? feasibilityScores.reduce((a, b) => a + b, 0) / feasibilityScores.length
      : 0;

    const highPriorityItems = solutionNodes.filter(node =>
      (node.priority || 0) >= 4 && (node.feasibility || 0) >= 3
    );

    const lowFeasibilityItems = solutionNodes.filter(node =>
      (node.feasibility || 0) <= 2
    );

    const recommendations = [];
    if (averageFeasibility < 3) {
      recommendations.push('Overall feasibility is low. Consider more realistic solutions.');
    }
    if (highPriorityItems.length === 0) {
      recommendations.push('No high-priority feasible items found. Reconsider priorities.');
    }

    return {
      averageFeasibility,
      highPriorityItems,
      lowFeasibilityItems,
      recommendations
    };
  }

  // Hypothesis generation functionality
  private generateHypotheses(nodeId: string): {
    hypotheses: string[];
    testingMethods: string[];
    assumptions: string[];
  } {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return { hypotheses: [], testingMethods: [], assumptions: [] };
    }

    const hypotheses: string[] = [];
    const testingMethods: string[] = [];
    const assumptions: string[] = [];

    switch (node.type) {
      case 'problem':
        hypotheses.push(`The main cause of ${node.content} is a combination of multiple factors`);
        hypotheses.push(`${node.content} occurs only under specific environmental conditions`);
        testingMethods.push('Data analysis to investigate correlations');
        testingMethods.push('Experimental condition changes for verification');
        break;
      case 'cause':
        hypotheses.push(`Removing ${node.content} will improve the problem`);
        hypotheses.push(`${node.content} interacts with other factors`);
        testingMethods.push('A/B testing to verify causal relationships');
        testingMethods.push('Gradual improvement implementation and effect measurement');
        break;
      case 'solution':
        hypotheses.push(`Implementing ${node.content} will achieve the expected results`);
        hypotheses.push(`${node.content} may have unexpected side effects`);
        testingMethods.push('Pilot test for effect verification');
        testingMethods.push('Risk analysis and mitigation strategy consideration');
        break;
    }

    assumptions.push('Current situation continues');
    assumptions.push('Available resources are limited');
    assumptions.push('Stakeholder cooperation is obtained');

    return { hypotheses, testingMethods, assumptions };
  }

  // Generate recommendations
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    const problemNodes = Array.from(this.nodes.values()).filter(n => n.type === 'problem');
    const solutionNodes = Array.from(this.nodes.values()).filter(n => n.type === 'solution');

    if (problemNodes.length > solutionNodes.length) {
      recommendations.push('Solutions are insufficient for the problems. Consider specific countermeasures for each problem.');
    }

    const unactionableNodes = solutionNodes.filter(n => !n.feasibility || n.feasibility < 3);
    if (unactionableNodes.length > 0) {
      recommendations.push('There are solutions with low feasibility. Consider more realistic alternatives.');
    }

    const highPriorityNodes = solutionNodes.filter(n => (n.priority || 0) >= 4);
    if (highPriorityNodes.length > 0) {
      recommendations.push(`Recommend starting with high-priority items: ${highPriorityNodes.map(n => n.content).join(', ')}`);
    }

    return recommendations;
  }

  // Check decomposition into concrete actions
  private assessActionability(nodeId: string): {
    actionabilityScore: number;
    issues: string[];
    suggestions: string[];
  } {
    const node = this.nodes.get(nodeId);
    if (!node || node.type !== 'solution') {
      return { actionabilityScore: 0, issues: ['Target node is not a solution'], suggestions: [] };
    }

    let score = 5;
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check for abstract expressions
    const abstractWords = ['improve', 'enhance', 'optimize', 'strengthen', 'consider', 'review'];
    if (abstractWords.some(word => node.content.toLowerCase().includes(word))) {
      score -= 2;
      issues.push('Contains abstract expressions');
      suggestions.push('Define more concrete actions (who, when, how)');
    }

    // Check for measurable goals
    const hasMetrics = /\d+|%|\$|time|day|hour|week|month/.test(node.content.toLowerCase());
    if (!hasMetrics) {
      score -= 1;
      issues.push('No measurable goals set');
      suggestions.push('Set quantitative target values');
    }

    // Check for deadlines
    if (!node.content.toLowerCase().includes('by') && !node.content.toLowerCase().includes('within') && !node.content.toLowerCase().includes('deadline')) {
      score -= 1;
      issues.push('Deadline is not clear');
      suggestions.push('Clarify execution deadline');
    }

    return {
      actionabilityScore: Math.max(1, score),
      issues,
      suggestions
    };
  }

  // Get current tree status and AI guidance
  private getTreeStatus(): {
    summary: string;
    statistics: object;
    currentState: string;
    aiGuidance: string[];
    suggestedNextSteps: Array<{operation: string; description: string; priority: number;}>;
  } {
    const stats = this.calculateNodeStatistics();
    const { totalNodes, nodesByType } = stats;

    let currentState = 'empty';
    let aiGuidance: string[] = [];
    let suggestedNextSteps: Array<{operation: string; description: string; priority: number;}> = [];

    if (totalNodes === 0) {
      currentState = 'empty';
      aiGuidance.push('Start by defining the main problem you want to analyze.');
      suggestedNextSteps.push({
        operation: 'add_node',
        description: 'Create root problem node',
        priority: 5
      });
    } else if (nodesByType.problem > 0 && (nodesByType.cause || 0) === 0) {
      currentState = 'problem_defined';
      aiGuidance.push('Good! You have defined the problem. Now identify potential causes.');
      suggestedNextSteps.push({
        operation: 'add_node',
        description: 'Add cause nodes to analyze root causes',
        priority: 5
      });
    } else if ((nodesByType.cause || 0) > 0 && (nodesByType.solution || 0) === 0) {
      currentState = 'causes_identified';
      aiGuidance.push('Excellent! You have identified causes. Now develop solutions.');
      suggestedNextSteps.push({
        operation: 'add_node',
        description: 'Add solution nodes for each cause',
        priority: 5
      });
      suggestedNextSteps.push({
        operation: 'analyze_tree',
        description: 'Run MECE validation on current analysis',
        priority: 3
      });
    } else if ((nodesByType.solution || 0) > 0) {
      currentState = 'solutions_developed';
      aiGuidance.push('Great! You have developed solutions. Consider analysis and prioritization.');
      suggestedNextSteps.push({
        operation: 'quick_analysis',
        description: 'Get quick analysis and recommendations',
        priority: 4
      });
      suggestedNextSteps.push({
        operation: 'suggest_actions',
        description: 'Get prioritized action recommendations',
        priority: 5
      });
    }

    // Add general suggestions based on tree size
    if (totalNodes > 5) {
      suggestedNextSteps.push({
        operation: 'visualize_tree',
        description: 'Visualize the complete tree structure',
        priority: 2
      });
    }

    return {
      summary: `Tree contains ${totalNodes} nodes: ${Object.entries(nodesByType).map(([type, count]) => `${count} ${type}`).join(', ')}`,
      statistics: nodesByType,
      currentState,
      aiGuidance,
      suggestedNextSteps: suggestedNextSteps.sort((a, b) => b.priority - a.priority)
    };
  }

  // Get specific next steps based on current tree state
  private getNextSteps(): {
    recommendedActions: Array<{
      operation: string;
      parameters: object;
      description: string;
      reasoning: string;
    }>;
    workflow: string[];
  } {
    const status = this.getTreeStatus();
    const recommendedActions: Array<{
      operation: string;
      parameters: object;
      description: string;
      reasoning: string;
    }> = [];

    const workflow = [
      "1. Define the main problem (add_node with nodeType='problem')",
      "2. Identify causes (add_node with nodeType='cause', parentId=problem_node)",
      "3. Develop solutions (add_node with nodeType='solution', parentId=cause_node)",
      "4. Validate with MECE analysis (analyze_tree or quick_analysis)",
      "5. Prioritize actions (suggest_actions)"
    ];

    switch (status.currentState) {
      case 'empty':
        recommendedActions.push({
          operation: 'add_node',
          parameters: {
            content: '[Your problem description]',
            nodeType: 'problem'
          },
          description: 'Create the root problem node',
          reasoning: 'Start analysis by clearly defining the main problem'
        });
        break;

      case 'problem_defined':
        const problemNode = Array.from(this.nodes.values()).find(n => n.type === 'problem');
        if (problemNode) {
          recommendedActions.push({
            operation: 'add_node',
            parameters: {
              content: '[Cause description]',
              nodeType: 'cause',
              parentId: problemNode.id
            },
            description: 'Add first cause to the problem',
            reasoning: 'Identify root causes to understand why the problem occurs'
          });
        }
        break;

      case 'causes_identified':
        const causes = Array.from(this.nodes.values()).filter(n => n.type === 'cause');
        if (causes.length > 0) {
          recommendedActions.push({
            operation: 'add_node',
            parameters: {
              content: '[Solution description]',
              nodeType: 'solution',
              parentId: causes[0].id,
              metadata: {
                priority: 3,
                feasibility: 3
              }
            },
            description: 'Add solution for the first cause',
            reasoning: 'Develop actionable solutions to address identified causes'
          });
        }
        break;

      case 'solutions_developed':
        recommendedActions.push({
          operation: 'quick_analysis',
          parameters: {},
          description: 'Run quick analysis for insights',
          reasoning: 'Validate your logic tree and get recommendations'
        });
        break;
    }

    return {
      recommendedActions,
      workflow
    };
  }

  // Quick analysis with focused output for AI consumption
  private quickAnalysis(): {
    summary: string;
    keyFindings: string[];
    topRecommendations: string[];
    nextActions: string[];
    aiGuidance: string;
  } {
    const meceValidation = this.validateMECE();
    const gaps = this.findGaps();
    const feasibility = this.assessOverallFeasibility();
    const status = this.getTreeStatus();

    const keyFindings: string[] = [];
    const topRecommendations: string[] = [];
    const nextActions: string[] = [];

    // Key findings
    if (!meceValidation.isComplete) {
      keyFindings.push(`MECE issues found: ${meceValidation.issues.length} overlaps/gaps detected`);
    }
    if (gaps.missingCauses.length > 0) {
      keyFindings.push(`${gaps.missingCauses.length} problems lack cause analysis`);
    }
    if (gaps.missingSolutions.length > 0) {
      keyFindings.push(`${gaps.missingSolutions.length} problems lack solutions`);
    }

    // Top recommendations (limit to 3)
    const recommendations = this.generateRecommendations();
    topRecommendations.push(...recommendations.slice(0, 3));

    // Next actions from feasibility analysis
    if (feasibility.highPriorityItems.length > 0) {
      nextActions.push(`Focus on ${feasibility.highPriorityItems.length} high-priority feasible items`);
    }
    if (feasibility.lowFeasibilityItems.length > 0) {
      nextActions.push(`Revise ${feasibility.lowFeasibilityItems.length} low-feasibility solutions`);
    }

    // AI Guidance
    let aiGuidance = status.aiGuidance[0] || 'Continue developing your logic tree.';
    if (status.suggestedNextSteps.length > 0) {
      aiGuidance += ` Suggested next step: ${status.suggestedNextSteps[0].description}`;
    }

    return {
      summary: status.summary,
      keyFindings,
      topRecommendations,
      nextActions,
      aiGuidance
    };
  }

  public processLogicTree(input: unknown): { content: Array<{ type: string; text: string }>; isError?: boolean } {
    try {
      const validatedInput = this.validateTreeData(input);

      let result: any = {
        operation: validatedInput.operation,
        timestamp: new Date().toISOString(),
        treeInfo: {
          totalNodes: this.nodes.size,
          rootNodeId: this.rootNodeId,
          hasRoot: !!this.rootNodeId
        }
      };

      switch (validatedInput.operation) {
        case 'add_node':
          if (!validatedInput.content || !validatedInput.nodeType) {
            throw new Error('add_node requires content and nodeType');
          }
          const options = validatedInput.metadata ? {
            confidence: validatedInput.metadata.confidence,
            priority: validatedInput.metadata.priority,
            feasibility: validatedInput.metadata.feasibility,
            evidence: validatedInput.metadata.evidence,
            assumptions: validatedInput.metadata.assumptions,
            tags: validatedInput.metadata.tags
          } : undefined;
          const newNode = this.addNode(validatedInput.content, validatedInput.nodeType, validatedInput.parentId, options);
          result.success = true;
          result.nodeId = newNode.id;
          result.nodeDetails = newNode;
          result.parentNode = validatedInput.parentId ? this.getNodeDetails(validatedInput.parentId) : null;
          break;

        case 'remove_node':
          if (!validatedInput.nodeId) {
            throw new Error('remove_node requires nodeId');
          }
          const nodeToRemove = this.getNodeDetails(validatedInput.nodeId);
          const removed = this.removeNode(validatedInput.nodeId);
          result.success = removed;
          result.nodeId = validatedInput.nodeId;
          result.removedNode = nodeToRemove;
          break;

        case 'move_node':
          if (!validatedInput.nodeId) {
            throw new Error('move_node requires nodeId');
          }
          const nodeToMove = this.getNodeDetails(validatedInput.nodeId);
          const oldParent = nodeToMove?.parentId ? this.getNodeDetails(nodeToMove.parentId) : null;
          const moved = this.moveNode(validatedInput.nodeId, validatedInput.newParentId);
          const newParent = validatedInput.newParentId ? this.getNodeDetails(validatedInput.newParentId) : null;
          result.success = moved;
          result.nodeId = validatedInput.nodeId;
          result.movedNode = this.getNodeDetails(validatedInput.nodeId);
          result.oldParent = oldParent;
          result.newParent = newParent;
          break;

        case 'update_node':
          if (!validatedInput.nodeId || !validatedInput.content) {
            throw new Error('update_node requires nodeId and content');
          }
          const updated = this.updateNode(validatedInput.nodeId, validatedInput.content, validatedInput.metadata);
          result.success = updated;
          result.nodeId = validatedInput.nodeId;
          result.updatedNode = this.getNodeDetails(validatedInput.nodeId);
          break;

        case 'visualize_tree':
          const visualization = this.visualizeTree();
          result.tree = visualization;
          result.treeStructure = this.getTreeStructure();
          break;

        case 'analyze_tree':
          const analysis = this.analyzeTree();
          result.analysis = analysis;
          result.treeStructure = this.getTreeStructure();
          break;

        case 'generate_hypotheses':
          if (!validatedInput.nodeId) {
            throw new Error('generate_hypotheses requires nodeId');
          }
          const hypotheses = this.generateHypotheses(validatedInput.nodeId);
          result.nodeId = validatedInput.nodeId;
          result.hypotheses = hypotheses;
          result.success = true;
          break;

        case 'suggest_actions':
          const suggestions = this.generateRecommendations();
          const overallFeasibility = this.assessOverallFeasibility();
          result.suggestions = suggestions;
          result.feasibilityAnalysis = overallFeasibility;
          result.success = true;
          break;

        case 'get_status':
          const status = this.getTreeStatus();
          result.status = status;
          result.success = true;
          break;

        case 'next_steps':
          const nextSteps = this.getNextSteps();
          result.nextSteps = nextSteps;
          result.success = true;
          break;

        case 'quick_analysis':
          const quickAnalysis = this.quickAnalysis();
          result.analysis = quickAnalysis;
          result.success = true;
          break;
      }

      if (!this.disableTreeLogging && validatedInput.operation === 'visualize_tree') {
        console.error(chalk.cyan('🌳 Logic Tree Visualization:'));
        console.error(result.tree);
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            operation: 'error',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
            status: 'failed',
            treeInfo: {
              totalNodes: this.nodes.size,
              rootNodeId: this.rootNodeId,
              hasRoot: !!this.rootNodeId
            }
          }, null, 2)
        }],
        isError: true
      };
    }
  }
}

const LOGIC_TREE_TOOL: Tool = {
  name: "logictree",
  description: `
# AI Logic Tree Analyst

A powerful tool for hierarchical problem analysis with AI guidance. This tool helps break down complex problems into structured logic trees, provides workflow guidance, and ensures continuous AI engagement through smart recommendations.

---

## Main Features

- **AI-Guided Workflow:** Smart guidance and next-step recommendations
- **Quick Analysis:** Focused outputs optimized for AI consumption
- **Hierarchical Structuring:** Organize problems, causes, and solutions
- **MECE Validation:** Automatically check logical completeness
- **Solution Assessment:** Evaluate feasibility and priority
- **Evidence-Based Reasoning:** Support analysis with data and assumptions

---

## Commands (Operations)

### 🚀 AI Guidance Operations (START HERE)
- \`get_status\`: Get current tree status with AI guidance and next steps
- \`next_steps\`: Get detailed workflow recommendations with specific actions
- \`quick_analysis\`: Get focused analysis results optimized for AI consumption

### 📝 Basic Operations
- \`add_node\`: Create a new node in the tree
- \`update_node\`: Modify existing node content or metadata
- \`remove_node\`: Delete a node and all descendants
- \`visualize_tree\`: Display the complete tree structure

### 🔍 Advanced Analysis
- \`analyze_tree\`: Comprehensive analysis with MECE validation
- \`generate_hypotheses\`: Generate testable hypotheses for a node
- \`suggest_actions\`: Get prioritized action recommendations

---

## AI Workflow Integration

**For continuous AI engagement, ALWAYS use these operations:**

1. **Start any session:** \`{"operation": "get_status"}\`
   - Gets current state and what to do next
   - Provides AI guidance for next steps

2. **After each major action:** \`{"operation": "quick_analysis"}\`
   - Gets focused insights without overwhelming output
   - Tells AI exactly what to do next

3. **When unsure:** \`{"operation": "next_steps"}\`
   - Gets specific parameter templates
   - Shows complete workflow guidance

---

## Streamlined Parameter Usage

**Simple node creation:**
\`{"operation": "add_node", "content": "Your problem", "nodeType": "problem"}\`

**With metadata (for solutions):**
\`{"operation": "add_node", "content": "Solution", "nodeType": "solution", "parentId": "node_1", "metadata": {"priority": 4, "feasibility": 3}}\`

**Check what to do next:**
\`{"operation": "get_status"}\`

---

## Example AI Session

**Start (ALWAYS begin with this):**
\`{"operation": "get_status"}\`
> Response includes: current state, AI guidance, suggested next operations

**If tree is empty, AI will be guided to:**
\`{"operation": "add_node", "content": "Low website conversion", "nodeType": "problem"}\`

**After adding nodes, check progress:**
\`{"operation": "quick_analysis"}\`
> Response: focused insights, key findings, next actions, AI guidance

**Get specific next steps:**
\`{"operation": "next_steps"}\`
> Response: exact parameters to use, workflow guidance, reasoning

This design ensures AI continues using the tool by providing clear guidance and focused outputs.
  `,
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["add_node", "remove_node", "move_node", "update_node", "visualize_tree", "analyze_tree", "generate_hypotheses", "suggest_actions", "get_status", "next_steps", "quick_analysis"],
        description: "The operation to perform on the logic tree. Start with 'get_status' for AI guidance."
      },
      nodeId: {
        type: "string",
        description: "Target node identifier (required for node-specific operations)"
      },
      content: {
        type: "string",
        description: "Text content for the node (required for add_node)"
      },
      nodeType: {
        type: "string",
        enum: ["problem", "cause", "effect", "solution", "decision", "option"],
        description: "Type/category of the node (required for add_node)"
      },
      parentId: {
        type: "string",
        description: "Parent node identifier (optional for root nodes)"
      },
      newParentId: {
        type: "string",
        description: "New parent node identifier (for move_node operation)"
      },
      metadata: {
        type: "object",
        properties: {
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description: "Confidence level in the node (0-1, optional for add_node)"
          },
          priority: {
            type: "number",
            minimum: 1,
            maximum: 5,
            description: "Priority level (1-5, optional for solution nodes)"
          },
          feasibility: {
            type: "number",
            minimum: 1,
            maximum: 5,
            description: "Feasibility score (1-5, optional for solution nodes)"
          },
          evidence: {
            type: "array",
            items: { type: "string" },
            description: "Supporting evidence for the node (optional)"
          },
          assumptions: {
            type: "array",
            items: { type: "string" },
            description: "Underlying assumptions (optional)"
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Categorization tags (optional)"
          }
        },
        description: "Additional attributes for the node (optional)"
      }
    },
    required: ["operation"]
  }
};

const server = new Server(
  {
    name: "logic-tree-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const treeServer = new LogicTreeServer();

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [LOGIC_TREE_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "logictree") {
    return treeServer.processLogicTree(request.params.arguments);
  }

  return {
    content: [{
      type: "text",
      text: `Unknown tool: ${request.params.name}`
    }],
    isError: true
  };
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Logic Tree MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
