const hre = require('hardhat');
const { loadFixture, setBalance } = require('@nomicfoundation/hardhat-toolbox/network-helpers');
const chai = require('chai');
const { randomBytes } = require('node:crypto');
const { revealCommit } = require('../dist');

describe('revealCommit.ts', function () {
  async function deployContractFixture() {
    // const operator = hre.ethers.Wallet.createRandom(hre.ethers.provider);
    // const guest = hre.ethers.Wallet.createRandom(hre.ethers.provider);
    const [operator, guest] = await hre.ethers.getSigners();

    await setBalance(operator.address, hre.ethers.parseEther('100'));
    await setBalance(guest.address, hre.ethers.parseEther('100'));

    const CommitRevealVRF = await hre.ethers.getContractFactory('$CommitRevealVRF');
    const commitRevealVRF = await CommitRevealVRF.deploy(operator.address, 1);
    await commitRevealVRF.waitForDeployment();

    return { operator, guest, commitRevealVRF };
  }

  async function getCommitData(guest, operator) {
    let guestSeed = randomBytes(32);
    const guestSeedHash = hre.ethers.keccak256(guestSeed);
    guestSeed = '0x' + guestSeed.toString('hex');

    let operatorSeed = randomBytes(32);
    const operatorSeedHash = hre.ethers.keccak256(operatorSeed);
    operatorSeed = '0x' + operatorSeed.toString('hex');

    const expiration = Math.floor(Date.now() / 1000) + 15 * 60;

    const operatorData = hre.ethers.solidityPacked(
      ['bytes32', 'bytes32', 'address', 'uint256'],
      [guestSeedHash, operatorSeedHash, guest.address, expiration]
    );
    const operatorDataHash = hre.ethers.keccak256(operatorData);

    const operatorSignature = await operator.signMessage(hre.ethers.getBytes(operatorDataHash));

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

  it('Should emit the correct event when the commit is revealed', async function () {
    const { operator, guest, commitRevealVRF } = await loadFixture(deployContractFixture);
    const { guestSeed, operatorSeed, operatorSeedHash, expiration, operatorDataHash, operatorSignature } =
      await getCommitData(guest, operator);

    await chai
      .expect(commitRevealVRF.connect(guest).$commit(guestSeed, operatorSeedHash, expiration, operatorSignature))
      .to.emit(commitRevealVRF, 'SeedCommitted')
      .withArgs(operatorDataHash, guestSeed, operatorSeedHash, guest.address);

    await new Promise((resolve, reject) => {
      commitRevealVRF.once('SeedRevealed', async (commitId, operatorSeed, randomSeed) => {
        try {
          chai.expect(commitId).to.be.equal(operatorDataHash);
          chai.expect(operatorSeed).to.be.equal(operatorSeed);
          chai.expect(randomSeed).to.be.properHex(64);

          resolve();
        } catch (e) {
          reject(e);
        }
      });

      try {
        revealCommit(commitRevealVRF, operatorDataHash, operatorSeed);
      } catch (e) {
        reject(e);
      }
    });
  });

  it('Should throw an error if the commit does not exist', async function () {
    const { operator, guest, commitRevealVRF } = await loadFixture(deployContractFixture);
    const { operatorSeed, operatorDataHash } = await getCommitData(guest, operator);

    await new Promise((resolve, reject) => {
      revealCommit(commitRevealVRF, operatorDataHash, operatorSeed).then(
        () => {
          reject(new Error('The `revealCommit` function was expected to throw an error.'));
        },
        (e) => {
          chai.expect(e).to.be.an('error');
          chai.expect(e.message).to.contain('CommitDoesNotExist');
          resolve();
        }
      );
    });
  });

  it('Should throw an error if the commit is already revealed', async function () {
    const { operator, guest, commitRevealVRF } = await loadFixture(deployContractFixture);
    const { guestSeed, operatorSeed, operatorSeedHash, expiration, operatorDataHash, operatorSignature } =
      await getCommitData(guest, operator);

    await chai
      .expect(commitRevealVRF.connect(guest).$commit(guestSeed, operatorSeedHash, expiration, operatorSignature))
      .to.emit(commitRevealVRF, 'SeedCommitted')
      .withArgs(operatorDataHash, guestSeed, operatorSeedHash, guest.address);

    await new Promise((resolve, reject) => {
      commitRevealVRF.once('SeedRevealed', async (commitId, operatorSeed, randomSeed) => {
        try {
          chai.expect(commitId).to.be.equal(operatorDataHash);
          chai.expect(operatorSeed).to.be.equal(operatorSeed);
          chai.expect(randomSeed).to.be.properHex(64);

          resolve();
        } catch (e) {
          reject(e);
        }
      });

      revealCommit(commitRevealVRF, operatorDataHash, operatorSeed).catch(reject);
    });

    await new Promise((resolve, reject) => {
      revealCommit(commitRevealVRF, operatorDataHash, operatorSeed).then(
        () => {
          reject(new Error('The `revealCommit` function was expected to throw an error.'));
        },
        (e) => {
          chai.expect(e).to.be.an('error');
          chai.expect(e.message).to.contain('CommitDoesNotExist');
          resolve();
        }
      );
    });
  });

  it('Should throw an error if the gas limit is too low', async function () {
    const { operator, guest, commitRevealVRF } = await loadFixture(deployContractFixture);
    const { guestSeed, operatorSeed, operatorSeedHash, expiration, operatorDataHash, operatorSignature } =
      await getCommitData(guest, operator);

    await chai
      .expect(commitRevealVRF.connect(guest).$commit(guestSeed, operatorSeedHash, expiration, operatorSignature))
      .to.emit(commitRevealVRF, 'SeedCommitted')
      .withArgs(operatorDataHash, guestSeed, operatorSeedHash, guest.address);

    await new Promise((resolve, reject) => {
      revealCommit(commitRevealVRF, operatorDataHash, operatorSeed, { gasLimit: 10000n }).then(
        () => {
          reject(new Error('The `revealCommit` function was expected to throw an error.'));
        },
        (e) => {
          chai.expect(e).to.be.an('error');
          chai.expect(e.message).to.contain('Transaction requires at least');
          resolve();
        }
      );
    });
  });

  it('Should throw an error if the reveal transaction ran out of gas', async function () {
    const { operator, guest, commitRevealVRF } = await loadFixture(deployContractFixture);
    const { guestSeed, operatorSeed, operatorSeedHash, expiration, operatorDataHash, operatorSignature } =
      await getCommitData(guest, operator);

    await chai
      .expect(commitRevealVRF.connect(guest).$commit(guestSeed, operatorSeedHash, expiration, operatorSignature))
      .to.emit(commitRevealVRF, 'SeedCommitted')
      .withArgs(operatorDataHash, guestSeed, operatorSeedHash, guest.address);

    await new Promise((resolve, reject) => {
      revealCommit(commitRevealVRF, operatorDataHash, operatorSeed, { gasLimit: 25000n }).then(
        () => {
          reject(new Error('The `revealCommit` function was expected to throw an error.'));
        },
        (e) => {
          chai.expect(e).to.be.an('error');
          chai.expect(e.message).to.contain('Transaction ran out of gas');
          resolve();
        }
      );
    });
  });

  it("Should throw an error if the operator doesn't have enough funds to send the reveal", async function () {
    const { operator, guest, commitRevealVRF } = await loadFixture(deployContractFixture);
    const { guestSeed, operatorSeed, operatorSeedHash, expiration, operatorDataHash, operatorSignature } =
      await getCommitData(guest, operator);

    await setBalance(operator.address, hre.ethers.parseEther('0'));

    await chai
      .expect(commitRevealVRF.connect(guest).$commit(guestSeed, operatorSeedHash, expiration, operatorSignature))
      .to.emit(commitRevealVRF, 'SeedCommitted')
      .withArgs(operatorDataHash, guestSeed, operatorSeedHash, guest.address);

    await new Promise((resolve, reject) => {
      revealCommit(commitRevealVRF, operatorDataHash, operatorSeed, { gasLimit: 50000n }).then(
        () => {
          reject(new Error('The `revealCommit` function was expected to throw an error.'));
        },
        (e) => {
          chai.expect(e).to.be.an('error');
          chai.expect(e.message).to.contain("sender doesn't have enough funds to send tx");
          resolve();
        }
      );
    });
  });

  it('Should throw an error if the reveal is made in the same block as the commit', async function () {
    const { operator, guest, commitRevealVRF } = await loadFixture(deployContractFixture);
    const { guestSeed, operatorSeed, operatorSeedHash, expiration, operatorDataHash, operatorSignature } =
      await getCommitData(guest, operator);

    // Disable the auto-mine
    await hre.network.provider.send('evm_setAutomine', [false]);

    await commitRevealVRF.connect(guest).$commit(guestSeed, operatorSeedHash, expiration, operatorSignature);

    // Enable the auto-mine (Next block will include all pending transactions)
    await hre.network.provider.send('evm_setAutomine', [true]);

    await new Promise((resolve, reject) => {
      revealCommit(commitRevealVRF, operatorDataHash, operatorSeed, { gasLimit: 100000n }).then(
        () => {
          reject(new Error('The `revealCommit` function was expected to throw an error.'));
        },
        (e) => {
          chai.expect(e).to.be.an('error');
          chai.expect(e.message).to.contain('InvalidRevealBlock');
          resolve();
        }
      );
    });
  });

  it('Should throw an error if the operator seed does not match the seed hash stored in the commit', async function () {
    const { operator, guest, commitRevealVRF } = await loadFixture(deployContractFixture);
    const { guestSeed, operatorSeedHash, expiration, operatorDataHash, operatorSignature } = await getCommitData(
      guest,
      operator
    );

    await chai
      .expect(commitRevealVRF.connect(guest).$commit(guestSeed, operatorSeedHash, expiration, operatorSignature))
      .to.emit(commitRevealVRF, 'SeedCommitted')
      .withArgs(operatorDataHash, guestSeed, operatorSeedHash, guest.address);

    const fakeOperatorSeed = '0x' + randomBytes(32).toString('hex');

    await new Promise((resolve, reject) => {
      revealCommit(commitRevealVRF, operatorDataHash, fakeOperatorSeed).then(
        () => {
          reject(new Error('The `revealCommit` function was expected to throw an error.'));
        },
        (e) => {
          chai.expect(e).to.be.an('error');
          chai.expect(e.message).to.contain('InvalidOperatorSeed');
          resolve();
        }
      );
    });
  });
});
