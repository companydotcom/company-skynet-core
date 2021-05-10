/*

 - getVendorConfig
    - does vendor config have details about joint account behavior?

 - get vendor data from account record
 - get vendor data from user record

 - do "handleJointAccounts" below
    - sometimes manipulates vendor data
    - sometimes manipulates user products
    - sometimes writes sometimes reads
    - sometimes calls vendor worker (or could set flag of whether it should be run later)

 - save service[]Data to user/account primary (depends on result of handleJointAccounts)
 - reemit event as handled
    - need specialized for jointly held?
 - handle queue
*/

/**
 * @function detectAssociatedAccounts
 * find any platform accounts that are allowed to share entitlements with this account (same email, maybe some source dependency)
 */
const detectAssociatedAccounts = () => {};

/**
 * @function isAccountEntitled
 * for a given associated account, determine if that account is entitled
 */
const isAccountEntitled = () => {};

/**
 * @function isAccountActiveOnProduct
 * for a given entitled associated account
 * determine if they have already hold an account with the present vendor
 */
const isAccountActiveOnProduct = () => {};

/**
 * @function earmarkPrimaryAccount
 * if we are activating an account based on an existing vendor account
 * we should add something to that accounts user.product record(?) or that that entitlement is being shared
 * - ideally, would like updateUserProduct to be the one handling the update as part of the normal event flow
 */
const earmarkMasterAccount = () => {};

/**
 * @function retrievePrimaryAccountVendorData
 * trying to keep the serviceUserData & serviceAccountData in sync
 * between two member platform accounts is probably prone to error
 * and we'd like to avoid having multiple sources of truth
 * when a secondary platform account needs to make requests to the vendor
 * and so needs the kind of info contained in service[]Data
 * the platform should retrieve the service[]Data from the primary
 * platform account for use with the vendor workers
 */
const retrievePrimaryAccountVendorData = () => {};

/**
 * @function saveVendorDataToPrimary
 * if the worker returns service[]Data, we should save it to
 * the "primary" account instead of the requesting account
 */
const saveVendorDataToPrimary = () => {};


/**
 * @function handleJointAccounts
 *
 */
export const handleJointAccounts = message => {
  const { eventType, eventName } = message;
  if (eventType === 'transition') {
    switch (eventName) { // currently also "eventType"
      case 'activate':
      case 'register':
        // find users with the same email, that are on sources
        // on the list of approved sources based on this email

        // search for same email
        // if users found
        //   check if from allowed source
        //   IF allowed
        //     check if provisioned
        //     IF provisioned
        //       DONT DELEGATE TO WORKER
        //       for this user/account - set service()Data to { refId: accountId/userId }
        //       for partnered account user/Account - add entitiesSharing account to service()Data
        //     ELSE not provisioned
        //       do nothing
        //       (should go to worker)
        //   ELSE not allowed
        //     (should go to worker?)
        //     [are there any consideration we need to take if we expect a collision of emails with the vendor?]
        // ELSE no other users
        //   great, existing case (should go to worker)
        //

        break;
      case 'optOut':
      case 'deactivate':
        // check if this is a shared account
        // if this is "primary"
        // - move primary to a different count
        // - update 3 accounts as needed
        // if not primary
        // - remove note linking accounts from this and primary account

        // check serviceAccountData serviceUserData (or should it be user/products)
        //    IF this is a joint account
        //      IF this is the "primary"
        //        IF this is shared by only one other account
        //          the "secondary" becomes a normal account
        //        ELSE the vendor account is tied to 3 or more
        //          need to promote one of the secondaries to "primary"
        //      ELSE this is a "secondary"
        //        remove service()Data { refId } markers from this account
        //        on primary account - remove reference to this account
        //        DONT delegate to account
        //    ELSE this is a normal case
        //      delegate to worker, normal case

        break;
      case 'changePlan':

        // really not sure
        // in other places we've referred to them sharing an "entitlement"
        // so if their entitlements are no longer the same... what happens?
        // if it's not a big problem then it's probably fine for this to be similar to a fetch event
        // but potentially - could be an issue if accountProducts entitle them to different ratePlans/features
        //    e.g. Yext BLR/BLM - if packages entitle you to Starter, and one account upgrades to Pro/Pro Plus
        //      the yext account should have the SKU updated, but the account product on the other account
        //      would not reflect that- do tiles on both accounts need to transition? some kind of fanout?
        //      there is a potential for very strange behavior

        break;
      default:
        // register?
        break;
    }
  } else if (eventType === 'fetch') {
    // check if requesting account's activation is based on another account
    // if it was, use serviceAccountData from that account

    // check service()Data
    //  IF data has (refId)
    //    lookup joint primary entity and pull service()Data from it
    //    pass that service()Data with the message to worker
    //  ELSE
    //    proceed as normal, pass service(Data) to worker
  }
};


/*
  Products could potentially have different ways that they want to handle
  accounts that are really the same person
  techAsi - share accounts always
  yext - always same? - what if you have multiple businesses?
  email - could want to share domain (share account) or separate (separate account)

  any vendor that does not want to always share account must be able to handle SSO appropriately (likely) have a unique identifier besides email

  how to handle kind of "multi-step" activation scenarios
  e.g. inky, when second account starts to activate
    and is identified as "joint", tile should go directly
    to the active state, doesn't need to go through "preactive"
    (unless maybe the primary account is still in preactive).
    do some kinds of transition events need to "echo" through
    other platform accounts that rely on a joint vendor account?

*/
