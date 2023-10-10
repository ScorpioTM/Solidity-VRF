const { ethers } = require('hardhat');
const { loadFixture, setBalance, mine } = require('@nomicfoundation/hardhat-toolbox/network-helpers');
const chai = require('chai');
const chaiHttp = require('chai-http');
const { randomBytes } = require('node:crypto');
const express = require('express');
const { router } = require('../dist');

chai.use(chaiHttp);

describe('router.ts', function () {
  async function deployContractFixture() {
    const operator = ethers.Wallet.createRandom(ethers.provider);
    const guest = ethers.Wallet.createRandom(ethers.provider);
    // const [owner, guest] = await ethers.getSigners();

    await setBalance(operator.address, ethers.parseEther('100'));
    await setBalance(guest.address, ethers.parseEther('100'));

    const CommitRevealVRF = await ethers.getContractFactory('$CommitRevealVRF');
    const commitRevealVRF = await CommitRevealVRF.deploy(operator.address, 3);
    await commitRevealVRF.waitForDeployment();

    const api = express();

    api.use(
      '/',
      router({
        redisUrl: 'redis://127.0.0.1:6379',
        jsonRpcUrl: 'http://127.0.0.1:8545/',
        privateKey: operator.privateKey,
        vrfAddress: await commitRevealVRF.getAddress(),
        expiration: 900,
        confirmations: 3
      })
    );

    return { operator, guest, commitRevealVRF, api };
  }

  describe('Settings', function () {
    it('Should throw an error if the redis server url is invalid', async function () {
      const { operator, commitRevealVRF } = await loadFixture(deployContractFixture);

      // During the test the env variable is set to test
      process.env.NODE_ENV = 'test';

      try {
        const api = express();

        api.use(
          '/',
          router({
            redisUrl: '',
            jsonRpcUrl: 'http://127.0.0.1:8545/',
            privateKey: operator.privateKey,
            vrfAddress: await commitRevealVRF.getAddress(),
            expiration: 900,
            confirmations: 3
          })
        );
      } catch (e) {
        chai.expect(e).to.be.an('error');
        chai.expect(e.message).to.contain('You must set a valid redis server URL.');
      }
    });

    it('Should throw an error if the JSON-RPC provider url is invalid', async function () {
      const { operator, commitRevealVRF } = await loadFixture(deployContractFixture);

      // During the test the env variable is set to test
      process.env.NODE_ENV = 'test';

      try {
        const api = express();

        api.use(
          '/',
          router({
            redisUrl: 'redis://127.0.0.1:6379',
            jsonRpcUrl: '',
            privateKey: operator.privateKey,
            vrfAddress: await commitRevealVRF.getAddress(),
            expiration: 900,
            confirmations: 3
          })
        );
      } catch (e) {
        chai.expect(e).to.be.an('error');
        chai.expect(e.message).to.contain('You must set a valid JSON-RPC provider URL.');
      }
    });

    it('Should throw an error if the private key is invalid', async function () {
      const { commitRevealVRF } = await loadFixture(deployContractFixture);

      // During the test the env variable is set to test
      process.env.NODE_ENV = 'test';

      try {
        const api = express();

        api.use(
          '/',
          router({
            redisUrl: 'redis://127.0.0.1:6379',
            jsonRpcUrl: 'http://127.0.0.1:8545/',
            privateKey: '',
            vrfAddress: await commitRevealVRF.getAddress(),
            expiration: 900,
            confirmations: 3
          })
        );
      } catch (e) {
        chai.expect(e).to.be.an('error');
        chai.expect(e.message).to.contain('You must set a valid private key.');
      }
    });

    it('Should throw an error if the contract address is invalid', async function () {
      const { operator } = await loadFixture(deployContractFixture);

      // During the test the env variable is set to test
      process.env.NODE_ENV = 'test';

      try {
        const api = express();

        api.use(
          '/',
          router({
            redisUrl: 'redis://127.0.0.1:6379',
            jsonRpcUrl: 'http://127.0.0.1:8545/',
            privateKey: operator.privateKey,
            vrfAddress: '',
            expiration: 900,
            confirmations: 3
          })
        );
      } catch (e) {
        chai.expect(e).to.be.an('error');
        chai.expect(e.message).to.contain('You must set a valid contract address.');
      }
    });

    it('Should throw an error if the expiration time is invalid', async function () {
      const { operator, commitRevealVRF } = await loadFixture(deployContractFixture);

      // During the test the env variable is set to test
      process.env.NODE_ENV = 'test';

      try {
        const api = express();

        api.use(
          '/',
          router({
            redisUrl: 'redis://127.0.0.1:6379',
            jsonRpcUrl: 'http://127.0.0.1:8545/',
            privateKey: operator.privateKey,
            vrfAddress: await commitRevealVRF.getAddress(),
            expiration: 0,
            confirmations: 3
          })
        );
      } catch (e) {
        chai.expect(e).to.be.an('error');
        chai.expect(e.message).to.contain('You must set a valid expiration time (in seconds).');
      }
    });

    it('Should throw an error if the confirmations number is invalid', async function () {
      const { operator, commitRevealVRF } = await loadFixture(deployContractFixture);

      // During the test the env variable is set to test
      process.env.NODE_ENV = 'test';

      try {
        const api = express();

        api.use(
          '/',
          router({
            redisUrl: 'redis://127.0.0.1:6379',
            jsonRpcUrl: 'http://127.0.0.1:8545/',
            privateKey: operator.privateKey,
            vrfAddress: await commitRevealVRF.getAddress(),
            expiration: 900,
            confirmations: 0
          })
        );
      } catch (e) {
        chai.expect(e).to.be.an('error');
        chai.expect(e.message).to.contain('You must set a valid confirmations number (expressed in blocks).');
      }
    });
  });

  describe('Commit API', function () {
    it('Should return an error when the `address` parameter is invalid.', async function () {
      const { api } = await loadFixture(deployContractFixture);

      await chai
        .request(api)
        .get('/commit')
        .query({ address: '', hash: '' })
        .then((res) => {
          chai.expect(res).to.be.json;
          chai.expect(res).to.have.status(400);
          chai.expect(res).to.be.a('object');
          chai.expect(res).to.have.property('body');
          chai.expect(res.body).to.have.property('error', 'The `address` parameter is invalid.');
        });
    });

    it('Should return an error when the `hash` parameter is invalid.', async function () {
      const { guest, api } = await loadFixture(deployContractFixture);

      await chai
        .request(api)
        .get('/commit')
        .query({ address: guest.address, hash: '' })
        .then((res) => {
          chai.expect(res).to.be.json;
          chai.expect(res).to.have.status(400);
          chai.expect(res).to.be.a('object');
          chai.expect(res).to.have.property('body');
          chai.expect(res.body).to.have.property('error', 'The `hash` parameter is invalid.');
        });
    });

    it('Should return valid commit details.', async function () {
      const { guest, api } = await loadFixture(deployContractFixture);

      let guestSeed = randomBytes(32);
      const guestSeedHash = ethers.keccak256(guestSeed);
      guestSeed = '0x' + guestSeed.toString('hex');

      await chai
        .request(api)
        .get('/commit')
        .query({ address: guest.address, hash: guestSeedHash })
        .then((res) => {
          chai.expect(res).to.be.json;
          chai.expect(res).to.have.status(200);
          chai.expect(res).to.be.a('object');
          chai.expect(res).to.have.property('body');
          chai.expect(res.body).to.have.property('commit_id').to.be.properHex(64);
          chai.expect(res.body).to.have.property('seed_hash').to.be.properHex(64);
          chai.expect(res.body).to.have.property('signature').to.be.properHex(130);
          chai.expect(res.body).to.have.property('expiration').to.be.a('number');
        });
    });

    it('Should reveal the commit automatically.', async function () {
      const { guest, api, commitRevealVRF } = await loadFixture(deployContractFixture);

      let guestSeed = randomBytes(32);
      const guestSeedHash = ethers.keccak256(guestSeed);
      guestSeed = '0x' + guestSeed.toString('hex');

      const commit = await chai
        .request(api)
        .get('/commit')
        .query({ address: guest.address, hash: guestSeedHash })
        .then((commitResponse) => {
          chai.expect(commitResponse).to.be.json;
          chai.expect(commitResponse).to.have.status(200);
          chai.expect(commitResponse).to.be.a('object');
          chai.expect(commitResponse).to.have.property('body');
          chai.expect(commitResponse.body).to.have.property('commit_id').to.be.properHex(64);
          chai.expect(commitResponse.body).to.have.property('seed_hash').to.be.properHex(64);
          chai.expect(commitResponse.body).to.have.property('signature').to.be.properHex(130);
          chai.expect(commitResponse.body).to.have.property('expiration').to.be.a('number');

          return commitResponse.body;
        });

      await new Promise((resolve, reject) => {
        commitRevealVRF.once('SeedRevealed', async (commitId, operatorSeed, randomSeed) => {
          try {
            chai.expect(commitId).to.be.equal(commit.commit_id);
            chai.expect(operatorSeed).to.be.properHex(64);
            chai.expect(randomSeed).to.be.properHex(64);

            resolve();
          } catch (e) {
            reject(e);
          }
        });

        try {
          (async () => {
            await chai
              .expect(
                commitRevealVRF.connect(guest).$commit(guestSeed, commit.seed_hash, commit.expiration, commit.signature)
              )
              .to.emit(commitRevealVRF, 'SeedCommitted')
              .withArgs(commit.commit_id, guestSeed, commit.seed_hash, guest.address);

            await mine(3);
          })();
        } catch (e) {
          reject(e);
        }
      });
    });
  });
});
