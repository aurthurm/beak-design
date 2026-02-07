import { SceneGraph } from "../canvas";
import type { Connection } from "../types/connections";
import type { SceneManager } from "./scene-manager";

export class ConnectionManager {
  private sceneManager: SceneManager;
  private connections: Connection[] = [];

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
  }

  public getConnections(): Connection[] {
    return this.connections;
  }

  public setConnections(connections: Connection[]): void {
    this.connections = connections;
  }

  public addConnection(
    connection: Omit<Connection, "id"> & { id?: string },
  ): void {
    const existingConnectionIndex = this.connections.findIndex(
      (c) =>
        (c.sourceNodeId === connection.sourceNodeId &&
          c.targetNodeId === connection.targetNodeId) ||
        (c.sourceNodeId === connection.targetNodeId &&
          c.targetNodeId === connection.sourceNodeId),
    );

    if (existingConnectionIndex !== -1) {
      this.connections.splice(existingConnectionIndex, 1);
    }

    const newConnection: Connection = {
      ...connection,
      id: connection.id || SceneGraph.createUniqueID(),
    };
    this.connections.push(newConnection);
    this.sceneManager.onConnectionsChanged(this.connections);
  }

  public removeConnection(connectionId: string): void {
    this.connections = this.connections.filter((c) => c.id !== connectionId);
    this.sceneManager.guidesManager.drawConnections(this.connections);
  }

  public redrawAllConnections(): void {
    this.sceneManager.guidesManager.drawConnections(this.connections);
  }

  public updateConnectionsForNode(nodeId: string): void {
    const hasConnection = this.connections.some(
      (c) => c.sourceNodeId === nodeId || c.targetNodeId === nodeId,
    );
    if (hasConnection) {
      this.sceneManager.guidesManager.drawConnections(this.connections);
    }
  }
}
