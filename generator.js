const fs = require("fs");
const path = require("path");

// Capitalize first letter
const capitalizeFirstLetter = (string) =>
  string.charAt(0).toUpperCase() + string.slice(1);

// Generate module
const generateModule = (moduleName) => {
  const modulePath = path.join(
    process.cwd(),
    "src",
    "app",
    "modules",
    moduleName
  );

  if (!fs.existsSync(modulePath)) {
    fs.mkdirSync(modulePath, { recursive: true });
  }

  // File paths
  const routesFile = path.join(modulePath, `${moduleName}.routes.ts`);
  const controllerFile = path.join(modulePath, `${moduleName}.controller.ts`);
  const serviceFile = path.join(modulePath, `${moduleName}.service.ts`);

  // Routes
  const routesContent = `import express from "express";
import { ${capitalizeFirstLetter(
    moduleName
  )}Controller } from "./${moduleName}.controller";

const router = express.Router();

router.get("/", ${capitalizeFirstLetter(moduleName)}Controller.getAll);
router.get("/:id", ${capitalizeFirstLetter(moduleName)}Controller.getById);
router.post("/", ${capitalizeFirstLetter(moduleName)}Controller.create);
router.put("/:id", ${capitalizeFirstLetter(moduleName)}Controller.update);
router.delete("/:id", ${capitalizeFirstLetter(moduleName)}Controller.remove);

export const ${capitalizeFirstLetter(moduleName)}Routes = router;
`;

  // Controller
  const controllerContent = `import { Request, Response } from "express";
import catchAsync from "../../middlewares/catchAsync";
import sendResponse from "../../shared/sendResponse";
import status from "http-status";
import { ${capitalizeFirstLetter(
    moduleName
  )}Service } from "./${moduleName}.service";

const getAll = catchAsync(async (req: Request, res: Response) => {
  const result = await ${capitalizeFirstLetter(moduleName)}Service.getAll${capitalizeFirstLetter(
    moduleName
  )}FromDB(req.query);
  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "${capitalizeFirstLetter(moduleName)} list fetched successfully",
    data: result,
  });
});

const getById = catchAsync(async (req: Request, res: Response) => {
  const result = await ${capitalizeFirstLetter(
    moduleName
  )}Service.getSingle${capitalizeFirstLetter(moduleName)}FromDB(req.params.id);
  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "${capitalizeFirstLetter(moduleName)} fetched successfully",
    data: result,
  });
});

const create = catchAsync(async (req: Request, res: Response) => {
  const result = await ${capitalizeFirstLetter(
    moduleName
  )}Service.post${capitalizeFirstLetter(moduleName)}IntoDB(req.body);
  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "${capitalizeFirstLetter(moduleName)} created successfully",
    data: result,
  });
});

const update = catchAsync(async (req: Request, res: Response) => {
  const payload = { id: req.params.id, ...req.body };
  const result = await ${capitalizeFirstLetter(
    moduleName
  )}Service.update${capitalizeFirstLetter(moduleName)}IntoDB(payload);
  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "${capitalizeFirstLetter(moduleName)} updated successfully",
    data: result,
  });
});

const remove = catchAsync(async (req: Request, res: Response) => {
  await ${capitalizeFirstLetter(
    moduleName
  )}Service.delete${capitalizeFirstLetter(moduleName)}FromDB(req.params.id);
  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "${capitalizeFirstLetter(moduleName)} deleted successfully",
    data: null,
  });
});

export const ${capitalizeFirstLetter(moduleName)}Controller = {
  getAll,
  getById,
  create,
  update,
  remove,
};
`;

  // Service
  const serviceContent = `import prisma from "../../shared/prisma";
import { paginationHelper } from "../../helpers/paginationHelper";
import { buildDynamicFilters } from "../../helpers/buildDynamicFilters";

const ${capitalizeFirstLetter(moduleName)}SearchableFields = ["name"]; // adjust fields

const getAll${capitalizeFirstLetter(moduleName)}FromDB = async (query: any) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(query);

  const whereConditions = buildDynamicFilters(query, ${capitalizeFirstLetter(
    moduleName
  )}SearchableFields);

  const total = await prisma.${moduleName}.count({ where: whereConditions });
  const result = await prisma.${moduleName}.findMany({
    where: whereConditions,
    skip,
    take: limit,
    orderBy: { [sortBy]: sortOrder },
  });

  const meta = {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };

  return { data: result, meta };
};

const getSingle${capitalizeFirstLetter(moduleName)}FromDB = async (id: string) => {
  return prisma.${moduleName}.findUnique({ where: { id } });
};

const post${capitalizeFirstLetter(moduleName)}IntoDB = async (data: any) => {
  return prisma.${moduleName}.create({ data });
};

const update${capitalizeFirstLetter(moduleName)}IntoDB = async ({ id, ...data }: any) => {
  return prisma.${moduleName}.update({ where: { id }, data });
};

const delete${capitalizeFirstLetter(moduleName)}FromDB = async (id: string) => {
  return prisma.${moduleName}.delete({ where: { id } });
};

export const ${capitalizeFirstLetter(moduleName)}Service = {
  getAll${capitalizeFirstLetter(moduleName)}FromDB,
  getSingle${capitalizeFirstLetter(moduleName)}FromDB,
  post${capitalizeFirstLetter(moduleName)}IntoDB,
  update${capitalizeFirstLetter(moduleName)}IntoDB,
  delete${capitalizeFirstLetter(moduleName)}FromDB,
};
`;

  // Helper to create file
  const createFile = (filePath, content) => {
    if (fs.existsSync(filePath)) {
      console.log(`❌ File already exists: ${filePath}`);
      return;
    }
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`✅ Created: ${filePath}`);
  };

  createFile(routesFile, routesContent);
  createFile(controllerFile, controllerContent);
  createFile(serviceFile, serviceContent);

  console.log(
    `🎉 ${moduleName} module generated successfully (Prisma CRUD, main router untouched)!`
  );
};

// CLI
const moduleName = process.argv[2];
if (!moduleName) {
  console.error("❌ Please provide a module name");
  process.exit(1);
}
generateModule(moduleName);
