/**
 * Index of one of the eight octants each `OctTree` node splits space into
 * around its own position. Bit 0 set means x smaller than the node's x, bit 1
 * set means y smaller, and bit 2 set means z smaller. A position equal to the
 * node's on an axis falls on the larger side of that axis.
 *
 * - `0`: x, y, z all equal or larger
 * - `1`: x smaller
 * - `2`: y smaller
 * - `3`: x and y smaller
 * - `4`: z smaller
 * - `5`: x and z smaller
 * - `6`: y and z smaller
 * - `7`: x, y, z all smaller
 *
 * @category Oct Tree
 */
export type OctTreeOctant = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
