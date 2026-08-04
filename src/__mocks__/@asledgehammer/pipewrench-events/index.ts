export const onGameStart = {
	addListener: jest.fn()
};

export const everyOneMinute = {
	addListener: jest.fn()
};

export const everyTenMinutes = {
	addListener: jest.fn()
};

export const everyHours = {
	addListener: jest.fn()
};

export const everyDays = {
	addListener: jest.fn()
};

export const onDawn = {
	addListener: jest.fn()
};

export const onCreatePlayer = {
	addListener: jest.fn()
};

export const onPlayerDeath = {
	addListener: jest.fn()
};

export const onGameBoot = {
	addListener: jest.fn()
};

export const onServerCommand = {
	addListener: jest.fn()
};

export const onClientCommand = {
	addListener: jest.fn()
};
export const onCreateLivingCharacter = {
	addListener: jest.fn()
};

export const onPreDistributionMerge = {
	addListener: jest.fn()
};

export const onCreateUI = {
	addListener: jest.fn()
};

export const onPostRender = {
	addListener: jest.fn()
};

export const onFillWorldObjectContextMenu = {
	addListener: jest.fn()
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export class EventEmitter<T> {
	addListener() {
		return jest.fn();
	}
}
