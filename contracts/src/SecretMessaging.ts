import {
  Field,
  SmartContract,
  state,
  State,
  method,
  PublicKey,
  MerkleMap,
  MerkleMapWitness,
  Poseidon,
  Permissions,
  AccountUpdate,
} from 'o1js';

export class SecretMessaging extends SmartContract {
  @state(Field) addressesRoot = State<Field>(); // Merket map of H(address) => field, 0: invalid address 1:valid address
  @state(Field) addressCount = State<Field>();

  @state(Field) messagesRoot = State<Field>(); // Merket map of H(address) => field
  @state(Field) messageCount = State<Field>();
  // @state(Field) adminAddressHash = State<Field>();

  events = {
    'publish-message': Field,
  };

  init() {
    super.init();
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });

    const map = new MerkleMap();
    // this.adminAddressHash.set(Poseidon.hash(this.sender.toFields()));
    this.addressesRoot.set(map.getRoot()); // set default root
    this.messagesRoot.set(map.getRoot()); // set default root
  }

  @method addAddress(address: PublicKey, witness: MerkleMapWitness) {
    this.requireSignature(); // Only Admin can add address

    const addressCount = this.addressCount.getAndRequireEquals();
    addressCount.assertLessThan(
      101,
      'there will be a maximum of 100 eligible addresses'
    );

    const addressesRoot = this.addressesRoot.getAndRequireEquals();
    const [oldRoot, key] = witness.computeRootAndKey(Field(0));
    addressesRoot.assertEquals(oldRoot);
    key.assertEquals(Poseidon.hash(address.toFields()));

    //update state
    const [newRoot] = witness.computeRootAndKey(Field(1));
    this.addressesRoot.set(newRoot);
    this.addressCount.set(addressCount.add(1));
  }

  @method depositMessage(
    message: Field,
    addressWitness: MerkleMapWitness,
    messageWitness: MerkleMapWitness
  ) {
    AccountUpdate.create(this.sender).requireSignature(); // proves the sender is not spoofed

    const messageCount = this.messageCount.getAndRequireEquals();
    const addressesRoot = this.addressesRoot.getAndRequireEquals();
    const messagesRoot = this.messagesRoot.getAndRequireEquals();

    const [computedAddressRoot, addressWitnessKey] =
      addressWitness.computeRootAndKey(Field(1));
    computedAddressRoot.assertEquals(addressesRoot);
    addressWitnessKey.assertEquals(Poseidon.hash(this.sender.toFields()));

    const [computedMessageRoot, messageWitnessKey] =
      messageWitness.computeRootAndKey(Field(0));
    computedMessageRoot.assertEquals(messagesRoot);
    messageWitnessKey.assertEquals(Poseidon.hash(this.sender.toFields()));

    verifyMessage(message);

    // update states
    const [newMessageRoot] = messageWitness.computeRootAndKey(message);
    this.messagesRoot.set(newMessageRoot);
    this.messageCount.set(messageCount.add(1));
    // emit events
    this.emitEvent('publish-message', message);
  }
}
function verifyMessage(message: Field) {
  const [flag1, flag2, flag3, flag4, flag5, flag6] = message.toBits();
  // If flag 1 is true, then all other flags must be false
  flag1
    .not()
    .or(
      flag1
        .and(flag2.not())
        .and(flag3.not())
        .and(flag4.not())
        .and(flag5.not())
        .and(flag6.not())
    )
    .assertTrue('If flag 1 is true, then all other flags must be false');
  // If flag 2 is true, then flag 3 must also be true.
  flag2
    .not()
    .or(flag2.and(flag3))
    .assertTrue('If flag 2 is true, then flag 3 must also be true');
  // If flag 4 is true, then flags 5 and 6 must be false.
  flag4
    .not()
    .or(flag4.and(flag5).and(flag6))
    .assertTrue('If flag 4 is true, then flags 5 and 6 must be false');
}
