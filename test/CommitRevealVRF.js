const hre = require('hardhat');
const { time, loadFixture } = require('@nomicfoundation/hardhat-toolbox/network-helpers');
const { anyValue } = require('@nomicfoundation/hardhat-chai-matchers/withArgs');
const { expect } = require('chai');
const { randomBytes } = require('node:crypto');

describe('CommitRevealVRF.sol', function () {
  async function deployContractFixture() {
    const [owner, operator, guest] = await hre.ethers.getSigners();

    const CommitRevealVRF = await hre.ethers.getContractFactory('$CommitRevealVRF');
    const commitRevealVRF = await CommitRevealVRF.deploy(operator.address, 1);
    await commitRevealVRF.waitForDeployment();

    return { commitRevealVRF, owner, operator, guest };
  }

  async function getCommitData(guest, operator) {
    let guestSeed = randomBytes(32);
    const guestSeedHash = hre.ethers.keccak256(guestSeed);
    guestSeed = '0x' + guestSeed.toString('hex');

    let operatorSeed = randomBytes(32);
    const operatorSeedHash = hre.ethers.keccak256(operatorSeed);
    operatorSeed = '0x' + operatorSeed.toString('hex');

    const expiration = (await time.latest()) + 15 * 60;

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

  describe('Deployment', function () {
    it('Should set the right owner', async function () {
      const { commitRevealVRF, owner } = await loadFixture(deployContractFixture);

      expect(
        await commitRevealVRF.hasRole(
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          owner.address
        )
      ).to.equal(true);
    });

    it('Should set the right operator', async function () {
      const { commitRevealVRF, operator } = await loadFixture(deployContractFixture);

      expect(
        await commitRevealVRF.hasRole(
          '0x97667070c54ef182b0f5858b034beac1b6f3089aa2d3188bb1e8929f4fa9b929',
          operator.address
        )
      ).to.equal(true);
    });
  });

  describe('Commits', function () {
    it('Should emit the correct event when the commit is created', async function () {
      const { commitRevealVRF, operator, guest } = await loadFixture(deployContractFixture);
      const { guestSeed, operatorSeedHash, expiration, operatorDataHash, operatorSignature } = await getCommitData(
        guest,
        operator
      );

      await expect(commitRevealVRF.connect(guest).$commit(guestSeed, operatorSeedHash, expiration, operatorSignature))
        .to.emit(commitRevealVRF, 'SeedCommitted')
        .withArgs(operatorDataHash, guestSeed, operatorSeedHash, guest.address);
    });

    it('Should revert if the commit already exists', async function () {
      const { commitRevealVRF, operator, guest } = await loadFixture(deployContractFixture);
      const { guestSeed, operatorSeedHash, expiration, operatorDataHash, operatorSignature } = await getCommitData(
        guest,
        operator
      );

      await expect(commitRevealVRF.connect(guest).$commit(guestSeed, operatorSeedHash, expiration, operatorSignature))
        .to.emit(commitRevealVRF, 'SeedCommitted')
        .withArgs(operatorDataHash, guestSeed, operatorSeedHash, guest.address);

      await expect(commitRevealVRF.connect(guest).$commit(guestSeed, operatorSeedHash, expiration, operatorSignature))
        .to.be.revertedWithCustomError(commitRevealVRF, 'CommitAlreadyExists')
        .withArgs(operatorDataHash);
    });

    it('Should revert if the signature is expired', async function () {
      const { commitRevealVRF, operator, guest } = await loadFixture(deployContractFixture);
      const { guestSeed, operatorSeedHash, expiration, operatorDataHash, operatorSignature } = await getCommitData(
        guest,
        operator
      );

      await time.increase(15 * 60 + 10);

      await expect(commitRevealVRF.connect(guest).$commit(guestSeed, operatorSeedHash, expiration, operatorSignature))
        .to.be.revertedWithCustomError(commitRevealVRF, 'ExpiredCommitSignature')
        .withArgs(operatorDataHash);
    });

    it('Should revert if the signature does not come from a valid operator', async function () {
      const { commitRevealVRF, owner, guest } = await loadFixture(deployContractFixture);
      const { guestSeed, operatorSeedHash, expiration, operatorDataHash, operatorSignature } = await getCommitData(
        guest,
        owner
      );

      await expect(commitRevealVRF.connect(guest).$commit(guestSeed, operatorSeedHash, expiration, operatorSignature))
        .to.be.revertedWithCustomError(commitRevealVRF, 'InvalidCommitSignature')
        .withArgs(operatorDataHash);
    });
  });

  describe('Reveals', function () {
    it('Should emit the correct event when the commit is revealed', async function () {
      const { commitRevealVRF, operator, guest } = await loadFixture(deployContractFixture);
      const { guestSeed, operatorSeed, operatorSeedHash, expiration, operatorDataHash, operatorSignature } =
        await getCommitData(guest, operator);

      await expect(commitRevealVRF.connect(guest).$commit(guestSeed, operatorSeedHash, expiration, operatorSignature))
        .to.emit(commitRevealVRF, 'SeedCommitted')
        .withArgs(operatorDataHash, guestSeed, operatorSeedHash, guest.address);

      await expect(commitRevealVRF.connect(operator).reveal(operatorDataHash, operatorSeed))
        .to.emit(commitRevealVRF, 'SeedRevealed')
        .withArgs(operatorDataHash, operatorSeed, anyValue);
    });

    it('Should revert if the commit does not exist', async function () {
      const { commitRevealVRF, operator, guest } = await loadFixture(deployContractFixture);
      const { operatorSeed, operatorDataHash } = await getCommitData(guest, operator);

      await expect(commitRevealVRF.connect(operator).reveal(operatorDataHash, operatorSeed))
        .to.be.revertedWithCustomError(commitRevealVRF, 'CommitDoesNotExist')
        .withArgs(operatorDataHash);
    });

    it('Should revert if the commit is already revealed', async function () {
      const { commitRevealVRF, operator, guest } = await loadFixture(deployContractFixture);
      const { guestSeed, operatorSeed, operatorSeedHash, expiration, operatorDataHash, operatorSignature } =
        await getCommitData(guest, operator);

      await expect(commitRevealVRF.connect(guest).$commit(guestSeed, operatorSeedHash, expiration, operatorSignature))
        .to.emit(commitRevealVRF, 'SeedCommitted')
        .withArgs(operatorDataHash, guestSeed, operatorSeedHash, guest.address);

      await expect(commitRevealVRF.connect(operator).reveal(operatorDataHash, operatorSeed))
        .to.emit(commitRevealVRF, 'SeedRevealed')
        .withArgs(operatorDataHash, operatorSeed, anyValue);

      await expect(commitRevealVRF.connect(operator).reveal(operatorDataHash, operatorSeed))
        .to.be.revertedWithCustomError(commitRevealVRF, 'CommitDoesNotExist')
        .withArgs(operatorDataHash);
    });

    it('Should revert if the reveal is made in the same block as the commit', async function () {
      const { commitRevealVRF, operator, guest } = await loadFixture(deployContractFixture);
      const { guestSeed, operatorSeed, operatorSeedHash, expiration, operatorDataHash, operatorSignature } =
        await getCommitData(guest, operator);

      const revealBlock = (await hre.ethers.provider.getBlockNumber()) + 1;

      await hre.network.provider.send('evm_setAutomine', [false]);

      await commitRevealVRF.connect(guest).$commit(guestSeed, operatorSeedHash, expiration, operatorSignature);

      await hre.network.provider.send('evm_setAutomine', [true]);

      await expect(commitRevealVRF.connect(operator).reveal(operatorDataHash, operatorSeed, { gasLimit: 100000n }))
        .to.be.revertedWithCustomError(commitRevealVRF, 'InvalidRevealBlock')
        .withArgs(operatorDataHash, revealBlock + 1, revealBlock);
    });

    it('Should revert if the operator seed does not match the seed hash stored in the commit', async function () {
      const { commitRevealVRF, operator, guest } = await loadFixture(deployContractFixture);
      const { guestSeed, operatorSeedHash, expiration, operatorDataHash, operatorSignature } = await getCommitData(
        guest,
        operator
      );

      await expect(commitRevealVRF.connect(guest).$commit(guestSeed, operatorSeedHash, expiration, operatorSignature))
        .to.emit(commitRevealVRF, 'SeedCommitted')
        .withArgs(operatorDataHash, guestSeed, operatorSeedHash, guest.address);

      const fakeOperatorSeed = '0x' + randomBytes(32).toString('hex');

      await expect(commitRevealVRF.connect(operator).reveal(operatorDataHash, fakeOperatorSeed))
        .to.be.revertedWithCustomError(commitRevealVRF, 'InvalidOperatorSeed')
        .withArgs(operatorDataHash, operatorSeedHash, fakeOperatorSeed);
    });
  });
});
