import {Filter, Document, OptionalId, ReturnDocument, UpdateFilter} from "mongodb";
import {dbCollection} from "../database/collection";
export class DbService {
    private readonly dbUrl: string;
    private readonly collectionName: string;
    private readonly collectionCache;
    constructor(dbUrl: string, collectionName: string) {
        this.dbUrl = dbUrl;
        this.collectionName = collectionName;
        this.collectionCache = {};
    }

    async getCollection() {
        if (!(this.collectionCache)[this.collectionName]) {
            this.collectionCache[this.collectionName] = await dbCollection(this.dbUrl, this.collectionName);
        }
        return this.collectionCache[this.collectionName].collection;
    }

    async findOne(query: Filter<Document>) {
        const collection = await this.getCollection();
        return await collection.findOne(query);
    }

    async insertOne(data: OptionalId<Document>) {
        const collection = await this.getCollection();
        await collection.insertOne(data);
    }

    async findOneAndUpdate(query: Filter<Document>, updateDoc: UpdateFilter<Document>) {
        const options = {
            returnDocument: ReturnDocument.AFTER
        };
        const collection = await this.getCollection();
        return await collection.findOneAndUpdate(query, updateDoc, options);
    }

    async updateOne(query: Filter<Document>, updateDoc: UpdateFilter<Document>) {
        const collection = await this.getCollection();
        return await collection.updateOne(query, updateDoc);
    }
}
