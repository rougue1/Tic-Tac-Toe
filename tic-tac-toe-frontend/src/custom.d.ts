declare module "*.module.css" {
    const classes: { [key: string]: string };
    export default classes;
}

// You might also add declarations for regular CSS files if you import those
declare module "*.css" {
    const classes: { [key: string]: string };
    export default classes;
}
