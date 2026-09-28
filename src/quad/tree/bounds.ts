/**
 * Axis-aligned rectangle used by `QuadTree.withinBounds()`. Both edges are
 * inclusive on each axis, so a position lying on an edge is inside. Every
 * value must be a finite number, and each min must not exceed its max.
 *
 * @category Quad Tree
 */
export interface QuadTreeBounds {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}
