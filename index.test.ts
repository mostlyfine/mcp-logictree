import { describe, it, expect, beforeEach } from 'vitest';

// LogicTreeServerクラスを直接インポートするため、index.tsから抽出する必要があります
// テスト用にクラスを分離するか、現在のファイルから直接テストします

// テスト用のLogicTreeServerクラスの定義
interface LogicTreeNode {
  id: string;
  content: string;
  type: 'problem' | 'cause' | 'effect' | 'solution' | 'decision' | 'option';
  parentId?: string;
  children: string[];
  level: number;
  expanded: boolean;
  confidence?: number;
  priority?: number;
  feasibility?: number;
  evidence?: string[];
  assumptions?: string[];
  tags?: string[];
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

// LogicTreeServerクラスをテスト用に再定義（本来は分離すべき）
class LogicTreeServer {
  private nodes: Map<string, LogicTreeNode> = new Map();
  private rootNodeId?: string;
  private nextId = 1;
  private disableTreeLogging: boolean;

  constructor() {
    this.disableTreeLogging = true; // テスト時はログを無効化
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

  private updateChildrenLevels(node: LogicTreeNode): void {
    node.children.forEach(childId => {
      const child = this.nodes.get(childId);
      if (child) {
        child.level = node.level + 1;
        this.updateChildrenLevels(child);
      }
    });
  }

  // 重複ロジックを含むメソッド1: getTreeStatus
  private getTreeStatus(): {
    summary: string;
    statistics: object;
    currentState: string;
    aiGuidance: string[];
    suggestedNextSteps: Array<{operation: string; description: string; priority: number;}>;
  } {
    const totalNodes = this.nodes.size;
    const nodesByType: Record<string, number> = {};

    // 重複ロジック: ノードの種類ごとのカウント
    this.nodes.forEach(node => {
      nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
    });

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
    }

    return {
      summary: `Tree contains ${totalNodes} nodes: ${Object.entries(nodesByType).map(([type, count]) => `${count} ${type}`).join(', ')}`,
      statistics: nodesByType,
      currentState,
      aiGuidance,
      suggestedNextSteps: suggestedNextSteps.sort((a, b) => b.priority - a.priority)
    };
  }

  // 重複ロジックを含むメソッド2: analyzeTree
  private analyzeTree(): object {
    const totalNodes = this.nodes.size;
    const nodesByType: Record<string, number> = {};
    const nodesByLevel: Record<number, number> = {};
    let maxDepth = 0;

    // 重複ロジック: ノードの種類ごとのカウント（getTreeStatusと同じ）
    this.nodes.forEach(node => {
      nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
      nodesByLevel[node.level] = (nodesByLevel[node.level] || 0) + 1;
      maxDepth = Math.max(maxDepth, node.level);
    });

    return {
      totalNodes,
      maxDepth: maxDepth + 1,
      nodesByType,
      nodesByLevel,
      hasRoot: !!this.rootNodeId,
      rootNodeId: this.rootNodeId,
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
          break;

        case 'remove_node':
          if (!validatedInput.nodeId) {
            throw new Error('remove_node requires nodeId');
          }
          const removed = this.removeNode(validatedInput.nodeId);
          result.success = removed;
          result.nodeId = validatedInput.nodeId;
          break;

        case 'move_node':
          if (!validatedInput.nodeId) {
            throw new Error('move_node requires nodeId');
          }
          const moved = this.moveNode(validatedInput.nodeId, validatedInput.newParentId);
          result.success = moved;
          result.nodeId = validatedInput.nodeId;
          break;

        case 'get_status':
          const status = this.getTreeStatus();
          result.status = status;
          result.success = true;
          break;

        case 'analyze_tree':
          const analysis = this.analyzeTree();
          result.analysis = analysis;
          result.success = true;
          break;
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
          }, null, 2)
        }],
        isError: true
      };
    }
  }

  // テスト用のヘルパーメソッド
  public getNodesCount(): number {
    return this.nodes.size;
  }

  public getRootNodeId(): string | undefined {
    return this.rootNodeId;
  }

  public getNode(nodeId: string): LogicTreeNode | undefined {
    return this.nodes.get(nodeId);
  }
}

describe('LogicTreeServer', () => {
  let server: LogicTreeServer;

  beforeEach(() => {
    server = new LogicTreeServer();
  });

  describe('正常系テスト', () => {
    it('空のツリーの初期状態が正しい', () => {
      expect(server.getNodesCount()).toBe(0);
      expect(server.getRootNodeId()).toBeUndefined();
    });

    it('ルートノード（問題）を追加できる', () => {
      const result = server.processLogicTree({
        operation: 'add_node',
        content: 'テスト問題',
        nodeType: 'problem'
      });

      expect(result.isError).toBeFalsy();
      expect(server.getNodesCount()).toBe(1);
      expect(server.getRootNodeId()).toBe('node_1');

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      expect(resultData.nodeDetails.content).toBe('テスト問題');
      expect(resultData.nodeDetails.type).toBe('problem');
    });

    it('子ノード（原因）を追加できる', () => {
      // まず問題ノードを追加
      server.processLogicTree({
        operation: 'add_node',
        content: 'テスト問題',
        nodeType: 'problem'
      });

      // 原因ノードを追加
      const result = server.processLogicTree({
        operation: 'add_node',
        content: 'テスト原因',
        nodeType: 'cause',
        parentId: 'node_1'
      });

      expect(result.isError).toBeFalsy();
      expect(server.getNodesCount()).toBe(2);

      const causeNode = server.getNode('node_2');
      expect(causeNode?.content).toBe('テスト原因');
      expect(causeNode?.type).toBe('cause');
      expect(causeNode?.parentId).toBe('node_1');
      expect(causeNode?.level).toBe(1);
    });

    it('getTreeStatusとanalyzeTreeが一貫した統計情報を返す', () => {
      // 複数のノードを追加
      server.processLogicTree({
        operation: 'add_node',
        content: 'テスト問題',
        nodeType: 'problem'
      });
      server.processLogicTree({
        operation: 'add_node',
        content: 'テスト原因1',
        nodeType: 'cause',
        parentId: 'node_1'
      });
      server.processLogicTree({
        operation: 'add_node',
        content: 'テスト原因2',
        nodeType: 'cause',
        parentId: 'node_1'
      });
      server.processLogicTree({
        operation: 'add_node',
        content: 'テスト解決策',
        nodeType: 'solution',
        parentId: 'node_2'
      });

      // getTreeStatusの結果を取得
      const statusResult = server.processLogicTree({ operation: 'get_status' });
      const statusData = JSON.parse(statusResult.content[0].text);

      // analyzeTreeの結果を取得
      const analyzeResult = server.processLogicTree({ operation: 'analyze_tree' });
      const analyzeData = JSON.parse(analyzeResult.content[0].text);

      // 両方のメソッドが同じ統計情報を返すことを確認
      expect(statusData.status.statistics).toEqual(analyzeData.analysis.nodesByType);
      expect(analyzeData.analysis.totalNodes).toBe(4);
      expect(statusData.status.statistics.problem).toBe(1);
      expect(statusData.status.statistics.cause).toBe(2);
      expect(statusData.status.statistics.solution).toBe(1);
    });

    it('ノードを削除できる', () => {
      // ノードを追加
      server.processLogicTree({
        operation: 'add_node',
        content: 'テスト問題',
        nodeType: 'problem'
      });

      // ノードを削除
      const result = server.processLogicTree({
        operation: 'remove_node',
        nodeId: 'node_1'
      });

      expect(result.isError).toBeFalsy();
      expect(server.getNodesCount()).toBe(0);
      expect(server.getRootNodeId()).toBeUndefined();

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
    });

    it('ノードを移動できる', () => {
      // 複数のノードを追加
      server.processLogicTree({
        operation: 'add_node',
        content: 'テスト問題1',
        nodeType: 'problem'
      });
      server.processLogicTree({
        operation: 'add_node',
        content: 'テスト問題2',
        nodeType: 'problem'
      });
      server.processLogicTree({
        operation: 'add_node',
        content: 'テスト原因',
        nodeType: 'cause',
        parentId: 'node_1'
      });

      // ノードを移動
      const result = server.processLogicTree({
        operation: 'move_node',
        nodeId: 'node_3',
        newParentId: 'node_2'
      });

      expect(result.isError).toBeFalsy();
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);

      const movedNode = server.getNode('node_3');
      expect(movedNode?.parentId).toBe('node_2');
    });
  });

  describe('異常系テスト', () => {
    it('不正なoperationでエラーが返る', () => {
      const result = server.processLogicTree({
        operation: 'invalid_operation'
      });

      expect(result.isError).toBe(true);
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.error).toContain('Invalid operation');
    });

    it('add_nodeで必須パラメータが不足している場合エラーが返る', () => {
      const result = server.processLogicTree({
        operation: 'add_node'
        // contentとnodeTypeが不足
      });

      expect(result.isError).toBe(true);
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.error).toContain('add_node requires content and nodeType');
    });

    it('存在しないnodeIdを削除しようとした場合falseが返る', () => {
      const result = server.processLogicTree({
        operation: 'remove_node',
        nodeId: 'nonexistent_node'
      });

      expect(result.isError).toBeFalsy();
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(false);
    });

    it('存在しないnodeIdを移動しようとした場合falseが返る', () => {
      const result = server.processLogicTree({
        operation: 'move_node',
        nodeId: 'nonexistent_node',
        newParentId: 'also_nonexistent'
      });

      expect(result.isError).toBeFalsy();
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(false);
    });

    it('存在しない親ノードを指定してノードを追加した場合、親子関係が正しく設定されない', () => {
      const result = server.processLogicTree({
        operation: 'add_node',
        content: 'テストノード',
        nodeType: 'cause',
        parentId: 'nonexistent_parent'
      });

      expect(result.isError).toBeFalsy();
      expect(server.getNodesCount()).toBe(1);

      const node = server.getNode('node_1');
      expect(node?.parentId).toBe('nonexistent_parent');
      // 存在しない親なので、実際の親子関係は設定されない
    });

    it('remove_nodeで必須パラメータが不足している場合エラーが返る', () => {
      const result = server.processLogicTree({
        operation: 'remove_node'
        // nodeIdが不足
      });

      expect(result.isError).toBe(true);
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.error).toContain('remove_node requires nodeId');
    });

    it('move_nodeで必須パラメータが不足している場合エラーが返る', () => {
      const result = server.processLogicTree({
        operation: 'move_node'
        // nodeIdが不足
      });

      expect(result.isError).toBe(true);
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.error).toContain('move_node requires nodeId');
    });
  });
});
