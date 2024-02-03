import {
  Field,
  SmartContract,
  state,
  State,
  method,
  PublicKey,
  Permissions,
  AccountUpdate,
  UInt64,
  Account,
} from 'o1js';

/**
 * Uses Custom tokens to store who are the eligible addresses
 * customTokenBalance   0: Not eligible   1: eligible   2: message deposited
 */
export class SecretMessaging extends SmartContract {
  @state(Field) addressCount = State<Field>();
  @state(Field) messageCount = State<Field>();

  events = {
    'publish-message': Field,
  };

  init() {
    super.init();
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
  }

  @method addAddress(address: PublicKey) {
    this.requireSignature(); // Only Admin can add address
    this.token.mint({ address, amount: 1n });
    const addressCount = this.addressCount.getAndRequireEquals();
    addressCount.assertLessThan(
      101,
      'there will be a maximum of 100 eligible addresses'
    );
  }

  @method depositMessage(message: Field) {
    AccountUpdate.create(this.sender).requireSignature(); // proves the sender is not spoofed
    const messageCount = this.messageCount.getAndRequireEquals();
    const senderAccount = Account(this.sender, this.token.id);
    const customTokenBalance = senderAccount.balance.getAndRequireEquals();
    customTokenBalance.assertEquals(UInt64.from(1));
    verifyMessage(message);
    // update states
    this.messageCount.set(messageCount.add(1));
    this.token.mint({ address: this.sender, amount: 1n });
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
