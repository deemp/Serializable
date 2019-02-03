import {AcceptedTypes} from "../models/AcceptedType";

/**
 * Class how help you deserialize object to classes.
 *
 * @export
 * @class Serializable
 */
export class Serializable {

    /**
     * Deserialize object from static method.
     *
     * Example:
     * const obj: MyObject = MyObject.fromJSON({...data});
     *
     * @static
     * @param {object} json
     * @returns {object}
     * @memberof Serializable
     */
    public static fromJSON<T extends Serializable>(this: new() => T, json: object): T {
        return new this().fromJSON(json);
    }

    /**
     * Fill property of current model by data from json.
     *
     * Example:
     * const obj: MyObject = new MyObject().fromJSON({...data});
     *
     * @param {object} ujson
     * @returns {this}
     * @memberof Serializable
     */
    public fromJSON(json: object): this {

        const ujson: unknown = json;

        if (
            ujson === null ||
            Array.isArray(ujson) ||
            typeof ujson !== "object"
        ) {
            this.onWrongType("", "is not object", ujson);

            return this;
        }

        for (const prop in ujson) {

            // json.hasOwnProperty(prop) - preserve for deserialization for other classes with methods
            if (
                ujson.hasOwnProperty(prop) &&
                this.hasOwnProperty(prop) &&
                Reflect.hasMetadata("ts-serializable:jsonTypes", this.constructor.prototype, prop)
            ) {

                const acceptedTypes: AcceptedTypes[] = Reflect.getMetadata(
                    "ts-serializable:jsonTypes",
                    this.constructor.prototype,
                    prop
                );

                const jsonValue: unknown = Reflect.get(ujson, prop);

                Reflect.set(
                    this,
                    prop,
                    this.deserializeProperty(prop, acceptedTypes, jsonValue)
                );

            }
        }

        return this;
    }

    /**
     * Process serelization for @jsonIgnore decorator
     *
     * @returns {object}
     * @memberof Serializable
     */
    public toJSON(): object {

        const json: object = Object.assign({}, this);

        for (const prop in json) {

            // json.hasOwnProperty(prop) - preserve for deserialization for other classes with methods
            if (json.hasOwnProperty(prop) && this.hasOwnProperty(prop)) {

                const isIgnore: boolean | void = Reflect.getMetadata(
                    "ts-serializable:jsonIgnore",
                    this.constructor.prototype,
                    prop
                );

                if (isIgnore) {
                    Reflect.set(json, prop, void 0);
                }

            }
        }

        return json;
    }

    /**
     * Process exceptions from wrong types.
     * By default just print warning in console, but can by override for drop exception or logging to backend.
     *
     * @protected
     * @param {string} prop
     * @param {string} message
     * @param {(unknown)} jsonValue
     * @memberof Serializable
     */
    protected onWrongType(prop: string, message: string, jsonValue: unknown): void {
        // tslint:disable-next-line:no-console
        console.error(`${this.constructor.name}.fromJSON: json.${prop} ${message}:`, jsonValue);
    }

    /**
     * //todo: write jsdoc
     *
     * @private
     * @param {object} object
     * @param {string} prop
     * @param {AcceptedTypes[]} acceptedTypes
     * @param {(unknown)} jsonValue
     * @returns {(Object | null | void)}
     * @memberof Serializable
     */
    // tslint:disable-next-line:cyclomatic-complexity
    private deserializeProperty(
        prop: string,
        acceptedTypes: AcceptedTypes[],
        jsonValue: unknown
    ): Object | null | void {

        for (const acceptedType of acceptedTypes) { // type Symbol is not a property

            if ( // null
                acceptedType === null &&
                jsonValue === null
            ) {

                return null;

            } else if ( // void, for classes deep copy only, json don't have void type
                acceptedType === void 0 &&
                jsonValue === void 0
            ) {

                return void 0;

            } else if ( // boolean, Boolean
                acceptedType === Boolean &&
                (typeof jsonValue === "boolean" || jsonValue instanceof Boolean)
            ) {

                return Boolean(jsonValue);

            } else if ( // number, Number
                acceptedType === Number &&
                (typeof jsonValue === "number" || jsonValue instanceof Number)
            ) {

                return Number(jsonValue);

            } else if ( // string, String
                acceptedType === String &&
                (typeof jsonValue === "string" || jsonValue instanceof String)
            ) {

                return String(jsonValue);

            } else if ( // object, Object
                acceptedType === Object &&
                (typeof jsonValue === "object")
            ) {

                return Object(jsonValue);

            } else if ( // Date
                acceptedType === Date &&
                (typeof jsonValue === "string" || jsonValue instanceof String || jsonValue instanceof Date)
            ) {

                // 0 year, 0 month, 0 days, 0 hours, 0 minutes, 0 seconds
                let unicodeTime: number = new Date("0000-01-01T00:00:00.000").getTime();
                // tslint:disable-next-line:strict-type-predicates
                if (typeof jsonValue === "string") {
                    unicodeTime = Date.parse(jsonValue);
                } else if (jsonValue instanceof String) {
                    unicodeTime = Date.parse(String(jsonValue));
                } else if (jsonValue instanceof Date) {
                    unicodeTime = jsonValue.getTime();
                }
                if (isNaN(unicodeTime)) { // preserve invalid time
                    this.onWrongType(prop, "is invalid date", jsonValue);
                }

                return new Date(unicodeTime);

            } else if ( // Array
                Array.isArray(acceptedType)
                && Array.isArray(jsonValue)
            ) {

                if (acceptedType[0] === void 0) {
                    this.onWrongType(prop, "invalid type", jsonValue);
                }

                return jsonValue.map((arrayValue: Object | void | null) => {
                    return this.deserializeProperty(prop, acceptedType, arrayValue);
                });

            } else if ( // Serializable
                acceptedType !== null &&
                acceptedType !== void 0 &&
                !Array.isArray(acceptedType) &&
                acceptedType.prototype instanceof Serializable &&
                jsonValue !== null &&
                jsonValue !== void 0 &&
                typeof jsonValue === "object" && !Array.isArray(jsonValue)
            ) {

                const typeConstructor: new () => Serializable = acceptedType as new () => Serializable;

                return new typeConstructor().fromJSON(jsonValue as object);

            } else if ( // instance any other class, not Serializable, for parse from other classes instance
                acceptedType instanceof Function &&
                jsonValue instanceof acceptedType
            ) {

                return jsonValue;

            }

        }

        // process wrong type and return default value
        this.onWrongType(prop, `is invalid`, jsonValue);

        return Reflect.get(this, prop);

    }
}
