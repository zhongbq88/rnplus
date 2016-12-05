const ActionTypes = {
  INIT: '@@redux/INIT',
};

function warning(message) {
    /* eslint-disable no-console */
  if (typeof console !== 'undefined' && typeof console.error === 'function') {
    console.error(message);
  }
    /* eslint-enable no-console */
  try {
        // This error was thrown as a convenience so that you can use this stack
        // to find the callsite that caused this warning to fire.
    throw new Error(message);
        /* eslint-disable no-empty */
  } catch (e) { }
    /* eslint-enable no-empty */
}


function getUndefinedStateErrorMessage(key, action) {
  const actionType = action && action.type;
  const actionName = actionType && `"${actionType.toString()}"` || 'an action';

  return (
        `Reducer "${key}" returned undefined handling ${actionName}. ` +
        'To ignore an action, you must explicitly return the previous state.'
    );
}

function getUnexpectedStateShapeWarningMessage(inputState, reducers, action) {
  const reducerKeys = Object.keys(reducers);
  const argumentName = action && action.type === ActionTypes.INIT ?
        'initialState argument passed to createStore' :
        'previous state received by the reducer';

  if (reducerKeys.length === 0) {
    return (
            'Store does not have a valid reducer. Make sure the argument passed ' +
            'to combineReducers is an object whose values are reducers.'
        );
  }

  if (!RNPlus.utils.extend(inputState)) {
    return (
            `The ${argumentName} has unexpected type of "` +
            ({}).toString.call(inputState).match(/\s([a-z|A-Z]+)/)[1] +
            '". Expected argument to be an object with the following ' +
            `keys: "${reducerKeys.join('", "')}"`
        );
  }

  const unexpectedKeys = Object.keys(inputState).filter(key => !reducers.hasOwnProperty(key));

  if (unexpectedKeys.length > 0) {
    return (
            `Unexpected ${unexpectedKeys.length > 1 ? 'keys' : 'key'} ` +
            `"${unexpectedKeys.join('", "')}" found in ${argumentName}. ` +
            'Expected to find one of the known reducer keys instead: ' +
            `"${reducerKeys.join('", "')}". Unexpected keys will be ignored.`
        );
  }
}

function assertReducerSanity(reducers) {
  Object.keys(reducers).forEach((key) => {
    const reducer = reducers[key];
    const initialState = reducer(undefined, { type: ActionTypes.INIT });

    if (typeof initialState === 'undefined') {
      throw new Error(
                `Reducer "${key}" returned undefined during initialization. ` +
                'If the state passed to the reducer is undefined, you must ' +
                'explicitly return the initial state. The initial state may ' +
                'not be undefined.'
            );
    }

    const type = '@@redux/PROBE_UNKNOWN_ACTION_' + Math.random().toString(36).substring(7).split('').join('.');
    if (typeof reducer(undefined, { type }) === 'undefined') {
      throw new Error(
                `Reducer "${key}" returned undefined when probed with a random type. ` +
                `Don't try to handle ${ActionTypes.INIT} or other actions in "redux/*" ` +
                'namespace. They are considered private. Instead, you must return the ' +
                'current state for any unknown actions, unless it is undefined, ' +
                'in which case you must return the initial state, regardless of the ' +
                'action type. The initial state may not be undefined.'
            );
    }
  });
}

/**
 * Turns an object whose values are different reducer functions, into a single
 * reducer function. It will call every child reducer, and gather their results
 * into a single state object, whose keys correspond to the keys of the passed
 * reducer functions.
 *
 * @param {Object} reducers An object whose values correspond to different
 * reducer functions that need to be combined into one. One handy way to obtain
 * it is to use ES6 `import * as reducers` syntax. The reducers may never return
 * undefined for any action. Instead, they should return their initial state
 * if the state passed to them was undefined, and the current state for any
 * unrecognized action.
 *
 * @returns {Function} A reducer function that invokes every reducer inside the
 * passed object, and builds a state object with the same shape.
 */
export default function combineReducers(reducers) {
  const reducerKeys = Object.keys(reducers);
  const finalReducers = {};
  for (let i = 0; i < reducerKeys.length; i++) {
    const key = reducerKeys[i];
    if (typeof reducers[key] === 'function') {
      finalReducers[key] = reducers[key];
    }
  }
  const finalReducerKeys = Object.keys(finalReducers);

  let sanityError;
  try {
    assertReducerSanity(finalReducers);
  } catch (e) {
    sanityError = e;
  }

  return function combination(state = {}, action) {
    if (sanityError) {
      throw sanityError;
    }

    if (process.env.NODE_ENV !== 'production') {
      const warningMessage = getUnexpectedStateShapeWarningMessage(state, finalReducers, action);
      if (warningMessage) {
        warning(warningMessage);
      }
    }

    let hasChanged = false;
    const nextState = {};
    for (let i = 0; i < finalReducerKeys.length; i++) {
      const key = finalReducerKeys[i];
      const reducer = finalReducers[key];
      const previousStateForKey = state[key];
      const nextStateForKey = reducer(previousStateForKey, action);
      if (typeof nextStateForKey === 'undefined') {
        const errorMessage = getUndefinedStateErrorMessage(key, action);
        throw new Error(errorMessage);
      }
      nextState[key] = nextStateForKey;
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
    }
    return hasChanged ? nextState : state;
  };
}
