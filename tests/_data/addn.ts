import {type ADT} from '../../src/adt';
import {repeat} from './repeat';

export function addNItems<ClassT extends ADT<unknown>>(instance: ClassT, n: number, f: Function) {
	repeat(n, (n: number) => {});
}
