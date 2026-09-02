const { parseCommand } = require('./src/lib/command');
const { orchestrateCouncilInvestigation } = require('./src/lib/council');

async function test() {
  try {
    const parsed = parseCommand('Should AI buy $BTC?');
    console.log('Parsed:', parsed);
    const inv = await orchestrateCouncilInvestigation('Should AI buy $BTC?', parsed.asset);
    console.log('Success:', inv.id, inv.asset, inv.decision.conclusion);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
