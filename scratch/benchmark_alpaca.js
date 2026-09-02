const { alpacaPaperAdapter } = require('./src/lib/trading/alpaca-paper-adapter');

async function benchmarkAlpaca() {
  console.log('=== BENCHMARKING ALPACA PAPER API CALLS ===\n');

  // 1. /v2/account
  const t0 = Date.now();
  try {
    const acc = await alpacaPaperAdapter.getAccount();
    const d0 = Date.now() - t0;
    console.log(`[PASS] /v2/account: ${d0}ms (status=${acc.status}, equity=$${acc.equity})`);
  } catch (e) {
    console.log(`[FAIL] /v2/account: ${Date.now() - t0}ms (${e.message})`);
  }

  // 2. /v2/positions
  const t1 = Date.now();
  try {
    const pos = await alpacaPaperAdapter.getPositions();
    const d1 = Date.now() - t1;
    console.log(`[PASS] /v2/positions: ${d1}ms (count=${pos.length})`);
  } catch (e) {
    console.log(`[FAIL] /v2/positions: ${Date.now() - t1}ms (${e.message})`);
  }

  // 3. /v2/clock
  const t2 = Date.now();
  try {
    const clock = await alpacaPaperAdapter.getClock();
    const d2 = Date.now() - t2;
    console.log(`[PASS] /v2/clock: ${d2}ms (isOpen=${clock.is_open})`);
  } catch (e) {
    console.log(`[FAIL] /v2/clock: ${Date.now() - t2}ms (${e.message})`);
  }

  // 4. /v2/orders (open)
  const t3 = Date.now();
  try {
    const orders = await alpacaPaperAdapter.getOrders('open');
    const d3 = Date.now() - t3;
    console.log(`[PASS] /v2/orders?status=open: ${d3}ms (count=${orders.length})`);
  } catch (e) {
    console.log(`[FAIL] /v2/orders?status=open: ${Date.now() - t3}ms (${e.message})`);
  }

  // 5. /v2/orders (closed)
  const t4 = Date.now();
  try {
    const closed = await alpacaPaperAdapter.getOrders('closed');
    const d4 = Date.now() - t4;
    console.log(`[PASS] /v2/orders?status=closed: ${d4}ms (count=${closed.length})`);
  } catch (e) {
    console.log(`[FAIL] /v2/orders?status=closed: ${Date.now() - t4}ms (${e.message})`);
  }
}

benchmarkAlpaca();
