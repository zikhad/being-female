export class ModData<T> {
	_data: T = {} as T;
	get data() {
		return jest.fn() as T;
	}
	set data(value: T) {
		this._data = value;
	}
}
