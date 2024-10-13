/* eslint-disable no-console */
import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import ensureError from './helpers/ensureError';

export class EventFetcher extends EventEmitter {
    private readonly _event: ethers.ContractEventName;

    private _provider?: ethers.JsonRpcProvider | ethers.WebSocketProvider;
    private _contract?: ethers.Contract;
    private _timer?: NodeJS.Timeout;

    private _firstBlock?: number;
    private _lastBlock?: number;
    private _liveBlock?: number;

    constructor(event: ethers.ContractEventName) {
        super();

        this._event = event;
    }

    get started(): boolean {
        return !!this._timer;
    }

    get firstBlock(): number | undefined {
        return this._firstBlock;
    }

    get lastBlock(): number | undefined {
        return this._lastBlock;
    }

    start(provider: ethers.JsonRpcProvider | ethers.WebSocketProvider, contract: ethers.Contract, firstBlock?: number): void {
        if (this.started) return;

        this._provider = provider;
        this._contract = contract;

        this._firstBlock = firstBlock;
        this._lastBlock = undefined;
        this._liveBlock = undefined;

        this._timer = setInterval(async () => await this._eventFetcher(), 1000);

        this.emit('start');
    }

    stop(...args: unknown[]): void {
        if (!this.started) return;

        clearInterval(this._timer);

        if (args && args.length > 0) {
            this.emit('error', args);
        }

        this.emit('stop');
    }

    private async _eventFetcher(): Promise<void> {
        if (!this._lastBlock || !this._liveBlock || this._lastBlock >= this._liveBlock) {
            // Query block number
            const liveBlock = await this._queryBlockNumber();

            if (!liveBlock) {
                this.stop(`Too many errors trying to get the block number`);

                return;
            }

            this._liveBlock = liveBlock;
        }

        let blockToHandle: number | undefined;

        if (!this._lastBlock) {
            if (!this._firstBlock) this._firstBlock = this._liveBlock;

            blockToHandle = this._firstBlock;
        } else {
            blockToHandle = this._lastBlock + 1;

            if (blockToHandle > this._liveBlock) return;
        }

        if (process.env.NODE_ENV === 'development' && blockToHandle < this._liveBlock) console.log(`EventFetcher: There's a delay of ${this._liveBlock - blockToHandle} blocks`);

        // Handle block events
        await this._handleBlock(blockToHandle);
    }

    private async _handleBlock(blockNumber: number): Promise<void> {
        // Query block events
        const events: Array<ethers.EventLog | ethers.Log> | undefined = await this._queryBlockEvents(blockNumber);

        if (!events) {
            this.stop(`Too many errors trying to get the block events`);

            return;
        }

        this.emit('block', blockNumber);

        events.forEach((event: ethers.EventLog | ethers.Log) => {
                if ('args' in event) {
                this.emit('event', ...[...event.args, event]);
            }
        });

        // Update previous block
        this._lastBlock = this._liveBlock;

        if (process.env.NODE_ENV === 'development') console.log(`EventFetcher: Block ${blockNumber} handled, ${events.length} events found`);
    }

    private async _queryBlockNumber(): Promise<number | undefined> {
        let block: number | undefined;
        let errors: number = 0;

        while (!block && errors < 3) {
            try {
                // Query block number
                block = await this._provider!.getBlockNumber();
            } catch (e: unknown) {
                errors++;
    
                this.emit('error', `Can't get the block number`, ensureError(e));
            }
        }

        return block;
    }

    private async _queryBlockEvents(blockNumber: number): Promise<Array<ethers.EventLog | ethers.Log> | undefined> {
        let events: Array<ethers.EventLog | ethers.Log> | undefined;
        let errors: number = 0;

        while (!events && errors < 3) {
            try {
                // Query block events
                events = await this._contract!.queryFilter(this._event, blockNumber, blockNumber);
            } catch (e: unknown) {
                errors++;
    
                this.emit('error', `Can't get the events from block ${blockNumber}`, ensureError(e));
            }
        }

        return events;
    }
}

export default EventFetcher;