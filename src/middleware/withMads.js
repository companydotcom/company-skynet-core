const createWithMads = options => {
  const serviceContextBefore = request => {
    // fetch vendorConfig
    // For now on userContext, but if these move to SSM/Parameter store
    // fetch serviceUserData
    // fetch serviceAccountData
  };

  const serviceContextAfter = request => {
    // set changes to serviceUserData/serviceAccoutnData
  };

  return {
    before: serviceContextBefore,
    after: serviceContextAfter,
  };
};

export default createWithMads;
