local BFFertilization = require "BF/AnimationEvents/Fertilization"

return function(actionInstance, eventName, parameter)
    return BFFertilization.onAnimationEvent(actionInstance, eventName, parameter)
end