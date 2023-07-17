export namespace Perf {

    export async function timeAsync<T>(name: string, f: () => T): Promise<T> {
        const startTime = performance.now();
        const result = await f();
        console.log(name, performance.now() - startTime, "ms");
        return result;
    }
    
}