---@diagnostic disable: undefined-global
local MODULE_NAME = "BFZomboLustAnimation"

local INCLUDED_TAGS = {
    Pregnancy = true
}

local function hasIncludedTag(tags)
    if not tags then
        return false
    end

    for key, value in pairs(tags) do
        if INCLUDED_TAGS[tostring(key)] or INCLUDED_TAGS[tostring(value)] then
            return true
        end
    end

    return false
end

local function isAllowedAction(action)
    if not action or not action.character then
        return false
    end

    local character = action.character
    if character:isZombie() or not character:isFemale() then
        return false
    end

    local stageConfig = action.stageConfig
    if not stageConfig or not stageConfig.animName then
        return false
    end

    if not ZomboDesire or not ZomboDesire.AnimationConfigs then
        return false
    end

    local globalConfig = ZomboDesire.AnimationConfigs[stageConfig.animName]
    if not globalConfig then
        return false
    end

    local tags = globalConfig.tags or globalConfig.Tags
    return hasIncludedTag(tags)
end

local function emitAnimationStart(_action)
    triggerEvent("BFWombAnimationStart", "intercourse")
end

local function emitAnimationUpdate(action)
    local delta = 0
    if action.getJobDelta then
        delta = action:getJobDelta() or 0
    end

    triggerEvent("BFWombAnimationUpdate", {
        delta = delta,
        duration = action.duration or 1
    })
end

local function emitAnimationStop()
    triggerEvent("BFWombAnimationStop")
end

local function patchAnimationAction()
    if not ISZomboDesireAnimationAction then
        return false
    end

    if ISZomboDesireAnimationAction.__BFAnimationHooked then
        return true
    end

    local originalStart = ISZomboDesireAnimationAction.start
    local originalUpdate = ISZomboDesireAnimationAction.update
    local originalPerform = ISZomboDesireAnimationAction.perform
    local originalStop = ISZomboDesireAnimationAction.stop

    function ISZomboDesireAnimationAction:start(...)
        if originalStart then
            originalStart(self, ...)
        end

        self.__BFWombAnimationActive = isAllowedAction(self)
        if self.__BFWombAnimationActive then
            emitAnimationStart(self)
        end
    end

    function ISZomboDesireAnimationAction:update(...)
        if originalUpdate then
            originalUpdate(self, ...)
        end

        if self.__BFWombAnimationActive then
            emitAnimationUpdate(self)
        end
    end

    function ISZomboDesireAnimationAction:perform(...)
        local shouldStopBFAnimation = self and self.__BFWombAnimationActive
        if self then
            self.__BFWombAnimationActive = false
        end

        if originalPerform then
            originalPerform(self, ...)
        end

        if shouldStopBFAnimation then
            emitAnimationStop()
        end
    end

    function ISZomboDesireAnimationAction:stop(...)
        local shouldStopBFAnimation = self and self.__BFWombAnimationActive
        if self then
            self.__BFWombAnimationActive = false
        end

        if originalStop then
            originalStop(self, ...)
        end

        if shouldStopBFAnimation then
            emitAnimationStop()
        end
    end

    ISZomboDesireAnimationAction.__BFAnimationHooked = true
    print("[" .. MODULE_NAME .. "] Hooked ISZomboDesireAnimationAction lifecycle")
    return true
end

local function isZomboLustActive()
    if not getActivatedMods then
        return false
    end

    local mods = getActivatedMods()
    if not mods or not mods.contains then
        return false
    end

    return mods:contains("ZomboLust")
end

local function tryPatch()
    if not isZomboLustActive() then
        return true
    end

    return patchAnimationAction()
end

if not tryPatch() then
    local function onTick()
        if tryPatch() then
            Events.OnTick.Remove(onTick)
        end
    end

    Events.OnTick.Add(onTick)
    Events.OnGameStart.Add(tryPatch)
end
