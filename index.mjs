import { MongoClient, ClientEncryption } from 'mongodb';

// Once we connect to the database once, we'll store that connection and reuse it so that we don't have to connect to the database on every request.
let cachedDb = null;
let clientEncrypted = null;

async function connectToDatabase() {
    if (cachedDb) {
        console.log("Using cached DB connection");
        return cachedDb;
    }

    const archLib = (process.env.LAMBDA_TASK_ROOT) ?
        process.env.LAMBDA_TASK_ROOT + '/lib/mongo_crypt_v1.so' :
        process.env.MONGODB_ENCRYPTION_LIB;
    
    const encOptions = {
        keyVaultNamespace: process.env.MONGODB_KEYVAULT,
        kmsProviders: {
            aws: {
                accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY
            }
        },
        extraOptions: { cryptSharedLibPath: archLib }
    };

    clientEncrypted = new MongoClient( process.env.MONGODB_URI, 
                                   { 'autoEncryption': encOptions } );
    await clientEncrypted.connect();
    cachedDb = clientEncrypted.db( 'medicalRecords' );

    return cachedDb;
}

export const handler = async (event) => {

    // Get an instance of our database
    const db = await connectToDatabase();
    const patients = db.collection("patients");

    let result = null;
    if (event.patientId) {
        result = await patients.insertOne(event);
    } else if (event.ssn) {
        result = await patients.findOne({"patientRecord.ssn": event.ssn});
    } else {
        result = await patients.findOne();
    }

    const response = {
        statusCode: 200,
        body: result,
    };
    return response;
};

//console.log("Lambda root: " + process.env.LAMBDA_TASK_ROOT);
//console.log(process.env);

if (process.env.LAMBDA_TASK_ROOT) {
    console.log('Running as lambda');
} else {
    console.log('Running locally');
    let result = await handler(JSON.parse(process.argv[2]));
    console.log(JSON.stringify(result, null, 4));
    await clientEncrypted.close();
}
