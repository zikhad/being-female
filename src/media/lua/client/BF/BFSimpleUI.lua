-- BFSimpleUI.lua
-- Self-contained UI panel system for BF.
-- Adapted from the 42UI API (MIT) by MrBounty.
-- All class names are prefixed with BF to avoid conflicts.

require "ISUI/ISCollapsableWindow"
require "ISUI/ISUIElement"
require "ISUI/ISImage"
require "ISUI/ISButton"


-- ---------------------------------------------------------------------------
-- Helper: cut text to fit a given pixel width
-- ---------------------------------------------------------------------------

local function BFCutTextToLong(text, width, font)
    while getTextManager():MeasureStringX(font, text) > width do
        text = string.sub(text, 1, #text - 1);
        if text == "" then break end
    end
    return text, getTextManager():MeasureStringX(font, text);
end


-- ---------------------------------------------------------------------------
-- BFSimpleText
-- ---------------------------------------------------------------------------

BFSimpleText = ISUIElement:derive("BFSimpleText");

function BFSimpleText:render()
    self:drawRect(0, 0, self.width, self.height,
        self.backgroundColor.a, self.backgroundColor.r,
        self.backgroundColor.g, self.backgroundColor.b);
    local y = (self.pxlH - self.textH) / 2;
    if self.position == "Left" then
        self:drawText(self.textToDisplay, 0, y, self.r, self.g, self.b, self.a, self.font);
    elseif self.position == "Right" then
        self:drawTextRight(self.textToDisplay, self:getWidth(), y, self.r, self.g, self.b, self.a, self.font);
    elseif self.position == "Center" then
        self:drawTextCentre(self.textToDisplay, self:getWidth() / 2, y, self.r, self.g, self.b, self.a, self.font);
    else
        self:drawText(self.textToDisplay, 0, y, self.r, self.g, self.b, self.a, self.font);
    end
    if self.border then
        self:drawRectBorder(0, 0, self:getWidth(), self:getHeight(), 0.5, 1, 1, 1);
    end
end

function BFSimpleText:setPositionAndSize()
    self.pxlW = self.parentUI.elemW[self.line][self.column];
    self.pxlX = self.parentUI.elemX[self.line][self.column];
    self.pxlH = self.parentUI.elemH[self.line];
    self.textH = getTextManager():getFontHeight(self.font);
    self:setX(self.pxlX);
    self:setY(self.pxlY);
    self:setWidth(self.pxlW);
    self:setHeight(self.pxlH);
    self.textToDisplay, self.textW = BFCutTextToLong(self.textOriginal, self:getWidth(), self.font);
end

function BFSimpleText:new(parentUI, text, font, position)
    local o = ISUIElement:new(0, 0, 1, 1);
    setmetatable(o, self);
    self.__index = self;

    o.parentUI  = parentUI;
    o.line      = parentUI.lineAct;
    o.column    = parentUI.columnAct;
    o.pxlY      = parentUI.yAct;

    o.a = 1; o.r = 1; o.g = 1; o.b = 1;
    o.backgroundColor = {r = 0, g = 0, b = 0, a = 1};
    o.anchorLeft = true; o.anchorRight = false;
    o.anchorTop  = true; o.anchorBottom = false;

    o.textOriginal = text or "";
    o.font         = font and UIFont[font] or UIFont.Small;
    o.position     = position or "Left";
    return o;
end

function BFSimpleText:setBorder(v)        self.border = v; end
function BFSimpleText:setWidthPercent(w)  self.isWidthForce = true; self.pxlW = w * getCore():getScreenWidth(); end
function BFSimpleText:setWidthPixel(w)    self.isWidthForce = true; self.pxlW = w; end
function BFSimpleText:setText(txt)
    self.textOriginal = txt;
    self.textToDisplay = txt;
end
function BFSimpleText:setVisible(v)       ISUIElement.setVisible(self, v); end


-- ---------------------------------------------------------------------------
-- BFSimpleImage
-- ---------------------------------------------------------------------------

BFSimpleImage = ISImage:derive("BFSimpleImage");

function BFSimpleImage:setPositionAndSize()
    self.pxlW = self.parentUI.elemW[self.line][self.column];
    self.pxlX = self.parentUI.elemX[self.line][self.column];
    if not self.isHeightForce then
        self.pxlH = self.parentUI.elemH[self.line];
    end
    self:setX(self.pxlX);
    self:setY(self.pxlY);
    self:setWidth(self.pxlW);
    self:setHeight(self.pxlH);
    self.scaledWidth  = self.pxlW;
    self.scaledHeight = self.pxlH;
end

function BFSimpleImage:render()
    if self.border then
        self:drawRectBorder(0, 0, self:getWidth(), self:getHeight(), 0.5, 1, 1, 1);
    end
end

function BFSimpleImage:new(parentUI, path, width, height)
    if not getTexture(path) then
        print("BF UI - WARNING: Texture not found: " .. path .. ". Using fallback.");
        path = "media/ui/emotes/no.png";
    end
    local o = ISImage:new(0, 0, 1, 1, getTexture(path));
    setmetatable(o, self);
    self.__index = self;

    o.parentUI = parentUI;
    o.line     = parentUI.lineAct;
    o.column   = parentUI.columnAct;
    o.pxlY     = parentUI.yAct;
    o.path     = path;
    o.isImage  = true;
    o.origW    = o.texture:getWidthOrig();
    o.origH    = o.texture:getHeightOrig();
    o.ratio    = o.origH / o.origW;
    o.border   = false;

    if width ~= nil and width > 0 then
        o.isWidthForce = true;
        o.pxlW = width;
    end

    if height ~= nil and height > 0 then
        o.isHeightForce = true;
        o.pxlH = height;
    end

    if o.isWidthForce and not o.isHeightForce then
        o.pxlH = o.pxlW * o.ratio;
        o.isHeightForce = true;
    elseif o.isHeightForce and not o.isWidthForce then
        o.isWidthForce = true;
        o.pxlW = o.pxlH / o.ratio;
    end

    return o;
end

function BFSimpleImage:setBorder(v)       self.border = v; end
function BFSimpleImage:setWidthPercent(w) self.isWidthForce = true; self.pxlW = w * getCore():getScreenWidth(); end
function BFSimpleImage:setWidthPixel(w)   self.isWidthForce = true; self.pxlW = w; end
function BFSimpleImage:setHeightPixel(h)  self.isHeightForce = true; self.pxlH = h; end
function BFSimpleImage:setPath(path)
    if not getTexture(path) then
        print("BF UI - WARNING: Texture not found: " .. path .. ". Using fallback.");
        path = "media/ui/emotes/no.png";
    end
    self.path    = path;
    self.texture = getTexture(path);
end
function BFSimpleImage:setVisible(v)      ISImage.setVisible(self, v); end


-- ---------------------------------------------------------------------------
-- BFSimpleButton
-- ---------------------------------------------------------------------------

BFSimpleButton = ISButton:derive("BFSimpleButton");

function BFSimpleButton:setText(text)
    self:setTitle(text);
end

function BFSimpleButton:onMouseUp(x, y)
    if not self:getIsVisible() then return; end
    local process = self.pressed == true;
    self.pressed = false;
    if self.onclick == nil then return; end
    if self.enable and (process or self.allowMouseUpProcessing) then
        getSoundManager():playUISound(self.sounds.activate);
        self.onclick(self, self.args);
    end
end

function BFSimpleButton:setPositionAndSize()
    self.pxlW = self.parentUI.elemW[self.line][self.column];
    self.pxlX = self.parentUI.elemX[self.line][self.column];
    self.pxlH = self.parentUI.elemH[self.line];
    self:setX(self.pxlX);
    self:setY(self.pxlY);
    self:setWidth(self.pxlW);
    self:setHeight(self.pxlH);
    self:setOnClick(self.func);
end

function BFSimpleButton:render()
    ISButton.render(self);
    if self.border then
        self:drawRectBorder(0, 0, self:getWidth(), self:getHeight(), 0.5, 1, 1, 1);
    end
end

function BFSimpleButton:new(parentUI, title, func)
    local o = ISButton:new(0, 0, 1, 1, title);
    setmetatable(o, self);
    self.__index = self;

    o.parentUI = parentUI;
    o.line     = parentUI.lineAct;
    o.column   = parentUI.columnAct;
    o.pxlY     = parentUI.yAct;
    o.func     = func;
    o.args     = {};
    return o;
end

function BFSimpleButton:setBorder(v)       self.border = v; end
function BFSimpleButton:setWidthPercent(w) self.isWidthForce = true; self.pxlW = w * getCore():getScreenWidth(); end
function BFSimpleButton:setWidthPixel(w)   self.isWidthForce = true; self.pxlW = w; end


-- ---------------------------------------------------------------------------
-- BFSimpleProgressBar
-- ---------------------------------------------------------------------------

BFSimpleProgressBar = ISUIElement:derive("BFSimpleProgressBar");

function BFSimpleProgressBar:render()
    self:drawRect(0, 0, self.width, self.height,
        self.backgroundColor.a, self.backgroundColor.r,
        self.backgroundColor.g, self.backgroundColor.b);

    if      self.value < self.min then self.value = self.min
    elseif  self.value > self.max then self.value = self.max
    end

    local pct = (self.value - self.min) / (self.max - self.min);
    self:drawRect(self.barMarginW, self.barMarginH,
        (self.pxlW - self.barMarginW * 2) * pct,
        self.pxlH - self.barMarginH * 2,
        self.a, self.r, self.g, self.b);

    if self.border then
        self:drawRectBorder(0, 0, self:getWidth(), self:getHeight(), 0.5, 1, 1, 1);
    end
end

function BFSimpleProgressBar:setPositionAndSize()
    self.pxlW = self.parentUI.elemW[self.line][self.column];
    self.pxlX = self.parentUI.elemX[self.line][self.column];
    self.pxlH = self.parentUI.elemH[self.line];
    self:setX(self.pxlX);
    self:setY(self.pxlY);
    self:setWidth(self.pxlW);
    self:setHeight(self.pxlH);
end

function BFSimpleProgressBar:new(parentUI, value, min, max)
    local o = ISUIElement:new(0, 0, 1, 1);
    setmetatable(o, self);
    self.__index = self;

    o.parentUI = parentUI;
    o.line     = parentUI.lineAct;
    o.column   = parentUI.columnAct;
    o.pxlY     = parentUI.yAct;

    o.a = 1; o.r = 1; o.g = 1; o.b = 1;
    o.backgroundColor = {r = 0, g = 0, b = 0, a = 1};
    o.anchorLeft = true; o.anchorRight  = false;
    o.anchorTop  = true; o.anchorBottom = false;

    o.value      = value;
    o.min        = min;
    o.max        = max;
    o.barMarginW = 0;
    o.barMarginH = 0;
    return o;
end

function BFSimpleProgressBar:setBorder(v)       self.border = v; end
function BFSimpleProgressBar:setWidthPercent(w) self.isWidthForce = true; self.pxlW = w * getCore():getScreenWidth(); end
function BFSimpleProgressBar:setWidthPixel(w)   self.isWidthForce = true; self.pxlW = w; end
function BFSimpleProgressBar:setValue(v)        self.value = v; end


-- ---------------------------------------------------------------------------
-- BFSimpleUI  (the panel window)
-- ---------------------------------------------------------------------------

BFSimpleUI = ISCollapsableWindow:derive("BFSimpleUI");

function BFSimpleUI:initialise()
    ISCollapsableWindow.initialise(self);
end

function BFSimpleUI:prerender()
    self:drawRect(0, self:titleBarHeight(), self.width, self.height - self:titleBarHeight(), 1, 0, 0, 0);
    ISCollapsableWindow.prerender(self);
end

-- Internal: compute each column's x-position and width for the current line.
function BFSimpleUI:addLineToMatrices(isLastLine)
    local i = self.lineAct;
    local nbElemWidthForce = 0;
    local widthLeft = self.pxlW;
    self.elemW[i] = {};
    self.elemX[i] = {};
    local nbElement = self.lineColumnCount[i];
    local w = math.floor(self.pxlW / (nbElement > 0 and nbElement or 1));

    for j = 1, self.lineColumnCount[i] do
        if self.matriceLayout[i][j].isWidthForce then
            nbElemWidthForce = nbElemWidthForce + 1;
            widthLeft = widthLeft - self.matriceLayout[i][j].pxlW;
        end
    end

    for j = 1, self.lineColumnCount[i] do
        if nbElemWidthForce ~= 0 or self.forceColumnWidht ~= {} then
            local nbElementLeft = nbElement - nbElemWidthForce;
            local w2 = math.floor(widthLeft / (nbElementLeft > 0 and nbElementLeft or 1));
            local elem = self.matriceLayout[i][j];

            if elem.isWidthForce then
                self.elemW[i][j] = elem.pxlW;
            elseif self.forceColumnWidht[j] ~= nil then
                self.elemW[i][j] = self.forceColumnWidht[j];
            else
                self.elemW[i][j] = w2;
            end

            self.elemX[i][j] = (j == 1) and 0 or (self.elemX[i][j - 1] + self.elemW[i][j - 1]);
        else
            self.elemW[i][j] = w;
            self.elemX[i][j] = w * (j - 1);
        end
    end

    -- Stretch last element to the panel edge (avoids pixel rounding gaps)
    if self.lineColumnCount[i] > 0 and not self.matriceLayout[i][self.lineColumnCount[i]].isImage then
        self.elemW[i][self.lineColumnCount[i]] =
            self.pxlW - self.elemX[i][self.lineColumnCount[i]];
    elseif self.lineColumnCount[i] > 0 and self.matriceLayout[i][self.lineColumnCount[i]].isImage then
        self:setWidthPixel(
            self.elemX[i][self.lineColumnCount[i]] + self.elemW[i][self.lineColumnCount[i]]);
    elseif not isLastLine then
        print("BF UI - WARNING: line " .. i .. " has no elements.");
    end
end

function BFSimpleUI:setElementsPositionAndSize()
    for _, v in ipairs(self.noNameElements) do v:setPositionAndSize(); end
    for _, v in pairs(self.namedElements)   do v:setPositionAndSize(); end
end

function BFSimpleUI:setBorderToAllElements(v)
    for _, e in ipairs(self.noNameElements) do e:setBorder(v); end
    for _, e in pairs(self.namedElements)   do e:setBorder(v); end
end

function BFSimpleUI:new(pctX, pctY, pctW)
    local sw = getCore():getScreenWidth();
    local sh = getCore():getScreenHeight();
    local o  = ISCollapsableWindow:new(sw * pctX, sh * pctY, sw * pctW, 1);
    setmetatable(o, self);
    self.__index = self;

    o:setHeight(o:titleBarHeight());

    o.pctX = pctX; o.pxlX = sw * pctX;
    o.pctY = pctY; o.pxlY = sh * pctY;
    o.pctW = pctW; o.pxlW = sw * pctW;

    o.noNameElements  = {};
    o.namedElements   = {};
    o.lineAct         = 1;
    o.elemY           = {};
    o.elemH           = {};
    o.elemW           = {};
    o.elemX           = {};
    o.lineColumnCount = {};
    o.columnAct       = 0;
    o.yAct            = o:titleBarHeight();
    o.forceColumnWidht = {};
    o.deltaY          = 0;
    o.lineHaveImages  = false;
    o.isUIVisible     = true;
    o.defaultLineHeight = getTextManager():getFontHeight(UIFont.Small) + 4;
    o.matriceLayout   = {};
    table.insert(o.elemY, o.yAct);
    table.insert(o.lineColumnCount, 0);

    o.resizable = false;
    o.drawFrame = true;
    return o;
end

-- Visibility ----------------------------------------------------------------

function BFSimpleUI:open()
    if not self.isUIVisible then
        self:setVisible(true);
        self.isUIVisible = true;
    end
end

function BFSimpleUI:close()
    if self.isUIVisible then
        self:setVisible(false);
        self.isUIVisible = false;
    end
end

function BFSimpleUI:toggle()
    if self.isUIVisible then
        self:setVisible(false);
        self.isUIVisible = false;
    else
        self:setVisible(true);
        self.isUIVisible = true;
    end
end

-- Layout helpers ------------------------------------------------------------

function BFSimpleUI:nextColumn()
    self.lineColumnCount[self.lineAct] = self.lineColumnCount[self.lineAct] + 1;
    self.columnAct = self.columnAct + 1;
end

function BFSimpleUI:nextLine()
    self:addLineToMatrices();
    self.columnAct = 0;

    if self.lineHaveImages and not self.lineHeightForce then
        self.lineHaveImages = false;
        for _, v in ipairs(self.matriceLayout[self.lineAct]) do
            if v.isImage then
                local desiredHeight = v.isHeightForce and v.pxlH or (self.elemW[v.line][v.column] * v.ratio);
                if self.deltaY < desiredHeight then
                    self.deltaY = desiredHeight;
                else
                    if not v.isWidthForce and not v.isHeightForce then
                        self.elemW[v.line][v.column] = self.deltaY / v.ratio;
                    end
                end
            end
        end
    end

    self.lineHeightForce = false;
    self.lineAct  = self.lineAct + 1;
    self.yAct     = self.yAct + self.deltaY;
    table.insert(self.elemH, self.deltaY);
    self.deltaY   = 0;
    table.insert(self.elemY, self.yAct);
    table.insert(self.lineColumnCount, 0);
end

function BFSimpleUI:initAndAddToTable(newE, name)
    newE:initialise();
    newE:instantiate();
    self:addChild(newE);

    if name == "" or not name then
        table.insert(self.noNameElements, newE);
    else
        if self[name] ~= nil then
            print("BF UI - WARNING: element name '" .. name .. "' already in use.");
        end
        self.namedElements[name] = newE;
        self[name] = newE;
    end

    if not self.matriceLayout[self.lineAct] then self.matriceLayout[self.lineAct] = {} end
    self.matriceLayout[self.lineAct][self.columnAct] = newE;
end

function BFSimpleUI:saveLayout()
    self:nextLine();
    self:setHeight(self.yAct);
    self:setElementsPositionAndSize();
    self.collapseButton:setVisible(false);
    self.pinButton:setVisible(false);
    self:addToUIManager();
    self:setInCenterOfScreen();
end

-- Add element methods -------------------------------------------------------

function BFSimpleUI:addText(name, txt, font, position)
    self:nextColumn();
    local newE = BFSimpleText:new(self, txt, font, position);
    self:initAndAddToTable(newE, name);
    local dh = self.defaultLineHeight;
    if self.deltaY < dh then self.deltaY = dh; end
end

function BFSimpleUI:addProgressBar(name, value, min, max)
    self:nextColumn();
    local newE = BFSimpleProgressBar:new(self, value, min, max);
    self:initAndAddToTable(newE, name);
    local dh = self.defaultLineHeight;
    if self.deltaY < dh then self.deltaY = dh; end
end

function BFSimpleUI:addButton(name, text, func)
    self:nextColumn();
    local newE = BFSimpleButton:new(self, text, func);
    self:initAndAddToTable(newE, name);
    local dh = self.defaultLineHeight;
    if self.deltaY < dh then self.deltaY = dh; end
end

function BFSimpleUI:addImage(name, path, sizeOrWidth, height)
    local width = nil;
    if type(sizeOrWidth) == "table" then
        width = sizeOrWidth.width;
        height = sizeOrWidth.height;
    else
        width = sizeOrWidth;
    end

    self:nextColumn();
    self.lineHaveImages = true;
    local newE = BFSimpleImage:new(self, path, width, height);
    self:initAndAddToTable(newE, name);
    local dh = self.defaultLineHeight;
    if self.deltaY < dh then self.deltaY = dh; end
end

-- Position / size -----------------------------------------------------------

function BFSimpleUI:setPositionPercent(pctX, pctY)
    local sw = getCore():getScreenWidth();
    local sh = getCore():getScreenHeight();
    self.pctX = pctX; self.pxlX = pctX * sw;
    self.pctY = pctY; self.pxlY = pctY * sh;
    self:setX(self.pxlX);
    self:setY(self.pxlY);
end

function BFSimpleUI:setPositionPixel(pxlX, pxlY)
    local sw = getCore():getScreenWidth();
    local sh = getCore():getScreenHeight();
    self.pxlX = pxlX; self.pctX = pxlX / sw;
    self.pxlY = pxlY; self.pctY = pxlY / sh;
    self:setX(self.pxlX);
    self:setY(self.pxlY);
end

function BFSimpleUI:setWidthPixel(pxlW)
    self.pxlW = pxlW;
    self.pctW = pxlW / getCore():getScreenWidth();
    self:setWidth(self.pxlW);
end

function BFSimpleUI:setInCenterOfScreen()
    local sw = getCore():getScreenWidth();
    local sh = getCore():getScreenHeight();
    self.pxlX = (sw - self:getWidth()) / 2;
    self.pxlY = (sh - self:getHeight()) / 2;
    self.pctX = self.pxlX / sw;
    self.pctY = self.pxlY / sh;
    self:setX(self.pxlX);
    self:setY(self.pxlY);
end


-- ---------------------------------------------------------------------------
-- Factory
-- ---------------------------------------------------------------------------

local allBFUI = {};

--- Create and register a new BF panel window.
--- @return BFSimpleUI
function NewBFUI()
    local ui = BFSimpleUI:new(0.4, 0.4, 0.2);
    ui:initialise();
    ui:instantiate();
    table.insert(allBFUI, ui);
    return ui;
end
