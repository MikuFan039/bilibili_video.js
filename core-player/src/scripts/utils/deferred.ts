export class Deferred<T> {
    resolve!: (value?: T | PromiseLike<T>) => void;
    reject!: (reason?: any) => void;
    private readonly promise: Promise<T>;

    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }

    then(onfulfilled?: (value: T) => T | PromiseLike<T>, onrejected?: (reason: any) => PromiseLike<never>): Promise<T> {
        return this.promise.then(onfulfilled, onrejected);
    }

    catch(onRejected?: (reason: any) => PromiseLike<never>): Promise<T> {
        return this.promise.catch(onRejected);
    }
}
