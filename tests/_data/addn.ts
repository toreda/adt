import {type DataStructure} from '../../src/data/structure';
import {repeat} from './repeat';

export function addNItems<ClassT extends DataStructure<unknown>>(instance: ClassT, n: number, f: Function) {
	repeat(n, (n: number) => {});
}
