import { SecretMessaging } from './SecretMessaging';
import {
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  MerkleMap,
  Poseidon,
} from 'o1js';

let proofsEnabled = true;

describe('Add', () => {
  let deployerAccount: PublicKey,
    deployerKey: PrivateKey,
    spy0: PublicKey,
    spy0key: PrivateKey,
    spy1: PublicKey,
    spy1key: PrivateKey,
    adminAddress: PublicKey,
    adminKey: PrivateKey,
    zkApp: SecretMessaging;

  beforeAll(async () => {
    if (proofsEnabled) await SecretMessaging.compile();
  });

  beforeEach(() => {
    const Local = Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);
    ({ privateKey: deployerKey, publicKey: deployerAccount } =
      Local.testAccounts[0]);
    ({ privateKey: spy0key, publicKey: spy0 } = Local.testAccounts[1]);
    ({ privateKey: spy1key, publicKey: spy1 } = Local.testAccounts[2]);

    adminKey = PrivateKey.random();
    adminAddress = adminKey.toPublicKey();
    zkApp = new SecretMessaging(adminAddress);
  });

  async function localDeploy() {
    const txn = await Mina.transaction(deployerAccount, () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      zkApp.deploy();
    });
    await txn.prove();
    // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
    await txn.sign([deployerKey, adminKey]).send();
  }

  it('generates and deploys the smart contract', async () => {
    await localDeploy();
  });

  it('add a new address', async () => {
    await localDeploy();

    // console.log('deployerAccount', deployerAccount.toBase58());
    // console.log('spy0', spy0.toBase58());
    // console.log('spy1', spy1.toBase58());
    // console.log('adminAddress', adminAddress.toBase58());

    let merkelMap = new MerkleMap();
    merkelMap.set(Poseidon.hash(spy0.toFields()), Field(1));

    const txn = await Mina.transaction(deployerAccount, () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      zkApp.addAddress(spy0);
    });
    await txn.prove();
    await txn.sign([deployerKey, adminKey]).send();

    // spy0 deposit's a message
    const txn1 = await Mina.transaction(spy0, () => {
      zkApp.depositMessage(Field(6));
    });
    await txn1.prove();
    await txn1.sign([spy0key]).send();
  });
});
