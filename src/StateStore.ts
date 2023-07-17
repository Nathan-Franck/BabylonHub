
/**
 * Store some state in the web browser.
 */
export class StateStore<T extends Record<any, any>> {
  constructor(private key: string, private state: T) {
    const stored = localStorage.getItem(key);
    if (stored) {
      this.state = JSON.parse(stored);
      var objectsToCheck: Array<{ stored: Record<any, any>, initial: Record<any, any> }> = [{ stored: this.state, initial: state }];
      check: while (objectsToCheck.length > 0) {
        const { stored, initial } = objectsToCheck.pop()!;
        for (const key in initial) {
          console.log("StateStore: checking state type", key, typeof initial[key], typeof stored[key]);
          if (typeof initial[key] !== typeof stored[key]) {
            console.log("StateStore: state type mismatch, using initial state", key, initial[key], this.state[key]);
            this.state = state;
            break check;
          }
          if (typeof initial[key] === "object") {
            objectsToCheck.push({ stored: stored[key], initial: initial[key] });
          }
        }
      }
    }
  }
  getState() {
    return this.state;
  }
  setState(state: T) {
    this.state = state;
    localStorage.setItem(this.key, JSON.stringify(state));
  }
}
