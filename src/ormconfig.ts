// import { DataSource } from 'typeorm';
// import path from 'path';

// export const  AppDataSource = new DataSource({
//   type: 'mysql',
//   host: process.env.NODE_ENV === 'production' ? process.env.DEV_AWS_HOST : process.env.DEV_AWS_HOST,
//   port: 3306,
//   username: process.env.NODE_ENV === 'production' ? process.env.DEV_AWS_USERNAME : process.env.DEV_AWS_USERNAME,
//   password: process.env.NODE_ENV === 'production' ? process.env.DEV_AWS_PASSWORD : process.env.DEV_AWS_PASSWORD,
//   database: process.env.NODE_ENV === 'production' ? process.env.DEV_AWS_DB_NAME : process.env.DEV_AWS_DB_NAME,
//   synchronize: true,
//   logging: false,
//   entities: [
//     path.join(__dirname, process.env.NODE_ENV === 'production' ? '/entity/**/*.js' : '/api/entity/**/*.ts')
//   ],
//   migrations: [
//     path.join(__dirname, process.env.NODE_ENV === 'production' ? '/migration/**/*.js' : '/migration/**/*.ts')
//   ],
//   subscribers: [
//     path.join(__dirname, process.env.NODE_ENV === 'production' ? '/subscriber/**/*.js' : '/subscriber/**/*.ts')
//   ],
//   // entities: ['src/api/entity/*.ts'], // Path to your entities
//   // migrations: ['src/migration/*.ts'], // Path to your migrations
//   // subscribers: ['src/subscriber/*.ts'], // Path to your subscribers
// });
