

/**
 * @function detectAssociatedAccounts
 * find any platform accounts that are allowed to share entitlements with this account (same email, maybe some source dependency)
 */
const detectAssociatedAccounts = (user, account, productId) => [];

/**
  * @function isAccountEntitled
  * for a given associated account, determine if that account is entitled
  */
const isAccountEntitled = (productId, account) => true;

/**
  * @function isAccountActiveOnProduct
  * for a given entitled associated account
  * determine if they have already hold an account with the present vendor
  */
const isAccountActiveOnProduct = (productId, account) => true;

/**
  * @function isJointPrimary
  * checks for indicator on user.products that this account is considered the "primary" for a given product joint account
  */
const isJointPrimary = (productId, account) => true;

/**
 * @function isJointMember
 * @param {string} productId
 * @param {*} account
 * @returns {bool}
 */
const isJointMember = (productId, account) => true;

/**
  * @function earmarkPrimaryAccount
  * if we are activating an account based on an existing vendor account
  * we should add something to that accounts user.product record(?) or that that entitlement is being shared
  * - ideally, would like updateUserProduct to be the one handling the update as part of the normal event flow
  */
const earmarkPrimaryAccount = (account, jointMembers) => {};

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


const setServiceAccountData = (accountId, data) => {};
const setServiceUserData = (userId, data) => {};

/**
  * @function saveVendorDataToPrimary
  * if the worker returns service[]Data, we should save it to
  * the "primary" account instead of the requesting account
  */
const saveVendorDataToPrimary = (account, data, destination) => {
  // ...find details for primary
  destination === 'account' ? setServiceAccountData(accountId, data) : setServiceUserData(userId, data);
};

/**
 * @function getJointMemberCount
 * @param {string} productId
 * @param {*} account any member of a joint account
 * @returns {Int} the current number of members on a joint account
 */
const getJointMemberCount = (productId, account) => 2;

/**
 * @function transferOwnership
 * used when the primary account deactivates/opts out
 * existing service[]Data should be transfered to another member
 * if that is then the only remaining member - then the annotations to describe the joint holding should be removed from both accounts
 */
const transferOwnership = () => {};

/**
 * @function removeSecondary
 * remove a non-primary account from the joint account
 * update User product
 * remove reference from primary account
 * mark this accounts service[]Data as deactivated
 */
const removeSecondary = () => {};


export const attemptJointAccount = async (user, account, productId) => {
  let candidateAccounts = detectAssociatedAccounts(user, account, productId);
  if (!candidateAccounts.length) {
    return { success: false };
  }
  candidateAccounts = candidateAccounts.filter(isAccountEntitled.bind(productId));
  if (!candidateAccounts.length) {
    return { success: false };
  }
  candidateAccounts = candidateAccounts.filter(isAccountActiveOnProduct.bind(productId));
  if (!candidateAccounts.length) {
    return { success: false };
  }
  let primaryAccount;
  if (candidateAccounts.length > 1) {
    primaryAccount = candidateAccounts.find(isJointPrimary.bind(productId)) || candidateAccounts[0];
  } else {
    primaryAccount = candidateAccounts[0];
  }
  earmarkPrimaryAccount(primaryAccount, account);
  const { serviceAccountData, serviceUserData } = await retrievePrimaryAccountVendorData(primaryAccount);
  return {
    success: true,
    existingAccountVendorData: { serviceAccountData, serviceUserData },
  };
};

export const removeFromJointAccount = (user, account, productId) => {
  if (!isJointMember(account)) {
    return { success: false };
  }
  try {
    if (isJointPrimary(account)) {
      transferOwnership(account);
    } else {
      removeSecondary(account);
    }
    return { success: true };
  } catch (err) {
    return { success: false };
  }
};

const allowedProductStatuses = ['active', 'inactive'];
export const setProductStatus = (context, productId, status) => {
  if (!allowedProductStatuses.includes(status)) {
    throw new Error(`Product status "${status}" is not permitted`);
  }
  switch (status) {
    case 'active':
      // emit event that looks much like today's "handled" transition event
      // fanout to updateUserProducts, marketo
      break;
    case 'inactive':
      // emit event that looks much like today's "handled" transition event
      // fanout to updateUserProducts, marketo
      break;
    default:
      throw new Error(`Product status "${status}" is not permitted`);
  }
};

export const setAccountData = (account, newData) => {
  if (isJointMember(account) && !isJointPrimary(account)) {
    saveVendorDataToPrimary(newData, 'account');
  } else {
    setServiceAccountData(account.accountId, newData);
  }
};

const setUserData = (account, newData) => {
  if (isJointMember(account) && !isJointPrimary(account)) {
    saveVendorDataToPrimary(account, 'user');
  } else {
    setServiceUserData(account.userId, newData);
  }
};
