/**
 * Index of one of the four quadrants each `QuadTree` node splits the plane
 * into around its own position. Bit 0 set means west (x smaller than the
 * node's x) and bit 1 set means south (y smaller than the node's y). A
 * position equal to the node's on an axis falls on the east or north side.
 *
 * - `0`: north-east
 * - `1`: north-west
 * - `2`: south-east
 * - `3`: south-west
 *
 * @category Quad Tree
 */
export type QuadTreeQuadrant = 0 | 1 | 2 | 3;
