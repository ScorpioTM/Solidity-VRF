const { ethers } = require('hardhat');
const { loadFixture, setBalance, mine } = require('@nomicfoundation/hardhat-toolbox/network-helpers');
const chai = require('chai');
const chaiHttp = require('chai-http');
const { randomBytes } = require('node:crypto');
const { createClient } = require('redis');
const { listener } = require('../dist/listener');

chai.use(chaiHttp);

describe('listener.ts', function () {
  async function deployContractFixture() {
    const [operator, guest] = await ethers.getSigners();

    await setBalance(operator.address, ethers.parseEther('100'));
    await setBalance(guest.address, ethers.parseEther('100'));

    const CommitRevealVRF = await ethers.getContractFactory('$CommitRevealVRF');
    const commitRevealVRF = await CommitRevealVRF.deploy(operator.address, 3);
    await commitRevealVRF.waitForDeployment();

    const redisClient = createClient({
      url: 'redis://localhost:6379'
    });

    // eslint-disable-next-line no-console
    redisClient.on('error', (e) => console.log('Redis Client Error', e));

    await redisClient.connect();

    listener(redisClient, operator.provider, operator, await commitRevealVRF.getAddress(), 3);

    return { operator, guest, commitRevealVRF, redisClient };
  }

  async function getCommitData(guest, operator) {
    let guestSeed = randomBytes(32);
    const guestSeedHash = ethers.keccak256(guestSeed);
    guestSeed = '0x' + guestSeed.toString('hex');

    let operatorSeed = randomBytes(32);
    const operatorSeedHash = ethers.keccak256(operatorSeed);
    operatorSeed = '0x' + operatorSeed.toString('hex');

    const expiration = Math.floor(Date.now() / 1000) + 900;

    const operatorData = ethers.solidityPacked(
      ['bytes32', 'bytes32', 'address', 'uint256'],
      [guestSeedHash, operatorSeedHash, guest.address, expiration]
    );
    const operatorDataHash = ethers.keccak256(operatorData);

    const operatorSignature = await operator.signMessage(ethers.getBytes(operatorDataHash));

    return {
      guestSeed,
      guestSeedHash,
      operatorSeed,
      operatorSeedHash,
      expiration,
      operatorData,
      operatorDataHash,
      operatorSignature
    };
  }

  it('Should throw an error if the contract address is invalid', async function () {
    const { operator, redisClient } = await loadFixture(deployContractFixture);

    await new Promise((resolve, reject) => {
      try {
        listener(redisClient, operator.provider, operator, '', 3);
        reject(new Error('The `listener` function was expected to throw an error.'));
      } catch (e) {
        chai.expect(e).to.be.an('error');
        chai.expect(e.message).to.contain('You must specify a valid contract address.');
        resolve();
      }
    });
  });

  it('Should throw an error if the number of confirmations required is invalid', async function () {
    const { operator, commitRevealVRF, redisClient } = await loadFixture(deployContractFixture);

    const commitRevealVRFAddress = await commitRevealVRF.getAddress();

    await new Promise((resolve, reject) => {
      try {
        listener(redisClient, operator.provider, operator, commitRevealVRFAddress, 0);
        reject(new Error('The `listener` function was expected to throw an error.'));
      } catch (e) {
        chai.expect(e).to.be.an('error');
        chai
          .expect(e.message)
          .to.contain('You must specify the number of confirmations required to approve a commit (Minimum 1 block).');
        resolve();
      }
    });
  });

  it('Should reveal the commit automatically', async function () {
    const { operator, guest, commitRevealVRF, redisClient } = await loadFixture(deployContractFixture);
    const { guestSeed, operatorSeed, operatorSeedHash, expiration, operatorDataHash, operatorSignature } =
      await getCommitData(guest, operator);

    await new Promise((resolve, reject) => {
      commitRevealVRF.once('SeedRevealed', async (commitId, _operatorSeed, randomSeed) => {
        try {
          chai.expect(commitId).to.be.equal(operatorDataHash);
          chai.expect(_operatorSeed).to.be.equal(operatorSeed);
          chai.expect(randomSeed).to.be.properHex(64);

          resolve();
        } catch (e) {
          reject(e);
        }
      });

      try {
        (async () => {
          // Save the operator seed for this commit
          await redisClient.set(operatorDataHash, operatorSeed, { EX: 900 });

          await chai
            .expect(commitRevealVRF.connect(guest).$commit(guestSeed, operatorSeedHash, expiration, operatorSignature))
            .to.emit(commitRevealVRF, 'SeedCommitted')
            .withArgs(operatorDataHash, guestSeed, operatorSeedHash, guest.address);

          await mine(3);
        })();
      } catch (e) {
        reject(e);
      }
    });
  });
});
