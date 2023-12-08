const Web3 = require("web3");
const abi = require("./abi.json");

const contractAddress = "0x25204087ac0aD19b77c8736ce6B88df87c63Cd4d";

async function web3i() {
  const web3 = await new Web3(
    new Web3.providers.HttpProvider(
      "https://attentive-blissful-spree.matic.quiknode.pro/bd22a8a5c97205dab253abd759c5ad2a2a6e4582/"
    )
  );

  const contractABI = abi;

  const contract = await new web3.eth.Contract(contractABI, contractAddress);

  return contract;
}

module.exports = web3i;
