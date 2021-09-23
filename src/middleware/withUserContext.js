const createWithUserContext = options => {
  const userContextBefore = request => {
    // Use ids to pull context
  };

  const userContextAfter = request => {
    // ??
  };

  return {
    before: userContextBefore,
    after: userContextAfter,
  };
};

export default createWithUserContext;
