import { ArmorCollection } from './collection';
import { ArmorCollectionSelector } from './selector';

export class ArmorQueue<T> implements ArmorCollection<T> {
  public elements: T[];

  constructor(elements: T[] = []) {
    if ( Array.isArray(this.elements)){
      this.elements = elements.slice();
    }
    else {
      this.elements = [];
    }
  }

  select(): () => ArmorCollectionSelector<T> {
    const selector = new ArmorCollectionSelector<T>(this);

    return selector;
  }

  clear() {

  }
}