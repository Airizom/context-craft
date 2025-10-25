import * as assert from "assert";
import * as sinon from "sinon";
import { debounce } from "../../debounce";

suite("debounce()", () => {
	test("executes exactly once after the specified delay", function () {
		this.timeout(1000);
		const clock: sinon.SinonFakeTimers = sinon.useFakeTimers();
		try {
			let invocationCount: number = 0;

			function underlyingFunction(): void { invocationCount++; }

			const debounced: () => void = debounce(underlyingFunction, 100);

			debounced();
			debounced();
			debounced();

			clock.tick(99);
			assert.strictEqual(invocationCount, 0, "underlying function ran too early");

			clock.tick(1);
			assert.strictEqual(invocationCount, 1, "underlying function did not run exactly once");
		} finally {
			clock.restore();
		}
	});
}); 
