import { encode } from "gpt-tokenizer/encoding/cl100k_base";
import * as vscode from "vscode";
import { isBinary } from "./utils";
import { MAX_PREVIEW_BYTES } from "./constants";

interface TokenCacheEntry {
    tokens: number;
    mtime: number;
    size: number;
}

const MAX_CACHE_SIZE = 5000;
const tokenCache = new Map<string, TokenCacheEntry>();

function createLimit(concurrency: number) {
    const queue: Array<() => void> = [];
    let running = 0;

    return function limit<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            const run = async () => {
                running++;
                try {
                    const result = await fn();
                    resolve(result);
                } catch (error) {
                    reject(error);
                } finally {
                    running--;
                    if (queue.length > 0 && running < concurrency) {
                        const next = queue.shift()!;
                        next();
                    }
                }
            };

            if (running < concurrency) {
                run();
            } else {
                queue.push(run);
            }
        });
    };
}

const limit = createLimit(8);

function evictOldestCacheEntries() {
    if (tokenCache.size > MAX_CACHE_SIZE) {
        const entries = Array.from(tokenCache.entries());
        const toDelete = entries.slice(0, tokenCache.size - MAX_CACHE_SIZE);
        for (const [key] of toDelete) {
            tokenCache.delete(key);
        }
    }
}

export async function countTokens(paths: string[], signal?: AbortSignal): Promise<number> {
    if (signal?.aborted) {
        return 0;
    }
    const start = Date.now();
    console.log(`[ContextCraft] countTokens start files=${paths.length}`);
    const tokenCounts = await Promise.all(
        paths.map(absPath => limit(async () => {
            if (signal?.aborted) {
                return 0;
            }
            try {
                const uri = vscode.Uri.file(absPath);
                const stats = await vscode.workspace.fs.stat(uri);
                
                if (stats.size > MAX_PREVIEW_BYTES) {
                    return 0;
                }

                const cached = tokenCache.get(absPath);
                if (cached && cached.mtime === stats.mtime && cached.size === stats.size) {
                    return cached.tokens;
                }

                if (signal?.aborted) {
                    return 0;
                }

                if (await isBinary(absPath)) {
                    return 0;
                }

                if (signal?.aborted) {
                    return 0;
                }

                const bytes = await vscode.workspace.fs.readFile(uri);
                const text = Buffer.from(bytes).toString("utf8");
                const tokens = encode(text).length;

                tokenCache.set(absPath, {
                    tokens,
                    mtime: stats.mtime,
                    size: stats.size
                });
                evictOldestCacheEntries();

                return tokens;
            } catch (error) {
                console.error(`Error processing file ${absPath} for token count:`, error);
                return 0;
            }
        }))
    );

    const total = tokenCounts.reduce((a, b) => a + b, 0);
    const end = Date.now();
    console.log(`[ContextCraft] countTokens done totalTokens=${total} in ${end - start}ms`);
    return total;
}
