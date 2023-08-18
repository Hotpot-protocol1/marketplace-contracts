const { ethers } = require('hardhat');
const LINK_MAINNET = "0x514910771AF9Ca656af840dff83E8264EcF986CA";

async function deployVRFContracts() {
  /* 
    MockV3Aggregator
   */
  const decimals = 18;
  const initial_answer = 3000000000000000n;
  const V3Aggregator = await ethers.deployContract(
    "MockV3Aggregator",
    [decimals, initial_answer]
  );
  await V3Aggregator.waitForDeployment();

  /* 
    VRFCoordinatorV2
   */
  const base_fee = 100000000000000000n;
  const gas_price_LINK = 1000000000n;
  const VRFCoordinator = await ethers.deployContract(
    "VRFCoordinatorV2Mock",
    [base_fee, gas_price_LINK]
  );
  await VRFCoordinator.waitForDeployment();

  /*
    VRFV2Wrapper deployment
  */
  const VRFV2Wrapper = await ethers.deployContract(
    "VRFV2Wrapper",
    [LINK_MAINNET, V3Aggregator.target, VRFCoordinator.target]
  );
  //await VRFV2Wrapper.waitForDeployment();

  return { V3Aggregator, VRFCoordinator, VRFV2Wrapper }
}

async function configureVRFV2Wrapper(VRFV2Wrapper) {
  const _wrapperGasOverhead = 60000;
  const _coordinatorGasOverhead = 52000;
  const _wrapperPremiumPercentage = 10;
  const _keyHash = "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc";
  const _maxNumWords = 10;
  const [owner] = await ethers.getSigners();
  await VRFV2Wrapper.connect(owner).setConfig(
    _wrapperGasOverhead, 
    _coordinatorGasOverhead, 
    _wrapperPremiumPercentage,
    _keyHash, 
    _maxNumWords
  );

  return VRFV2Wrapper;
}

async function fundSubscription(VRFCoordinator) {
  const id = 1;
  const amount = 500n * BigInt(1e18);
  await VRFCoordinator.fundSubscription(id, amount);
  return VRFCoordinator;
}

async function deployHotpotImplementation() {

  const vrf_contracts = await deployVRFContracts();
  let V3Aggregator = vrf_contracts.V3Aggregator;
  let VRFCoordinator = vrf_contracts.VRFCoordinator;
  let VRFV2Wrapper = vrf_contracts.VRFV2Wrapper;

  VRFV2Wrapper = await configureVRFV2Wrapper(VRFV2Wrapper);
  VRFCoordinator = await fundSubscription(VRFCoordinator);
  const vrf_v2_wrapper_address = VRFV2Wrapper.target;
  const LINK_address = LINK_MAINNET;

  const hotpot_impl = await ethers.deployContract("Hotpot", [
    LINK_address,
    vrf_v2_wrapper_address
  ]);
  await hotpot_impl.waitForDeployment();

  console.log(
    `Hotpot implementation contract deployed to ${hotpot_impl.target}`
  );

  return {hotpot_impl, V3Aggregator, VRFCoordinator, VRFV2Wrapper};
}

module.exports = {
    deployHotpotImplementation
}