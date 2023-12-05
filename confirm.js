const Web3 = require("web3");

async function confirm(tx) {
  const web3 = await new Web3(
    new Web3.providers.HttpProvider(
      "https://attentive-blissful-spree.matic.quiknode.pro/bd22a8a5c97205dab253abd759c5ad2a2a6e4582/"
    )
  );

  const contractAddress = "0x60df8e064e885C1F0DFd53193e4F0c637424c001";
  const account = "0x906dEEC6fD50586B3ebA7802e935eEAA7d16a393";
  const gasPrice = await web3.eth.getGasPrice();

  const encodedTx = tx.encodeABI();

  const nonce = await web3.eth.getTransactionCount(account);

  const gasLimit = 1000000;

  const transactionObject = {
    nonce: web3.utils.toHex(nonce),
    from: account,
    to: contractAddress,
    gasLimit: web3.utils.toHex(gasLimit),
    gasPrice: web3.utils.toHex(gasPrice),
    data: encodedTx,
  };

  const signedTransaction = await web3.eth.accounts.signTransaction(
    transactionObject,
    "99bfc152fa6ad58f6532bad0c1cc2c1862eeb9f2f648b02035030a68f54847b0"
  ); 

  const ok = await web3.eth.sendSignedTransaction(
    signedTransaction.rawTransaction
  );

  hash = signedTransaction.transactionHash;

  console.log("hash", hash);

  return hash;
}

module.exports = confirm;
