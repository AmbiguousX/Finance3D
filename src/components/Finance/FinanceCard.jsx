// FinanceCard.js
import { React, useState } from "react";
import {
    Card,
    CardHeader,
    CardBody,
    CardFooter,
    Button,
    Menu,
    MenuHandler,
    MenuList,
    MenuItem,
} from "@material-tailwind/react";
import { Bars3Icon } from "@heroicons/react/24/outline";
import TerrainShader from "./terrain";

const models = [
    {
        modelName: "Apple Stock",
        symbol: "AAPL"
    }
];

export default function FinanceCard({ defaultModelIndex = 0 }) {
    const [selectedModelIndex, setSelectedModelIndex] = useState(defaultModelIndex);
    const { modelName } = models[selectedModelIndex];
    const [hoverData, setHoverData] = useState(null);

    return (
        <Card className="bg-gradient-to-b from-gray-800 to-gray-600 w-auto mx-auto">
            <CardHeader
                floated={false}
                className="relative h-auto py-4 bg-slate-50"
            >
                <div className="flex items-center justify-between px-4">
                    <div className="flex flex-col gap-1">
                        <span className="font-poppins text-lg">{modelName}</span>
                        {hoverData ? (
                            <div className="flex flex-col text-sm space-y-0.5 text-gray-700">
                                <div className="flex gap-4">
                                    <span>Day: {hoverData.day}</span>
                                    <span>Month: {hoverData.month}</span>
                                </div>
                                <div className="flex gap-4">
                                    <span>Price: ${hoverData.price}</span>
                                    <span>Height: {hoverData.rawHeight}%</span>
                                </div>
                            </div>
                        ) : (
                            <span className="text-sm text-gray-600">Hover over terrain for data</span>
                        )}
                    </div>
                    <Menu>
                        <MenuHandler>
                            <Button color="white" size="sm">
                                <Bars3Icon className="w-6 h-6" />
                            </Button>
                        </MenuHandler>
                        <MenuList>
                            {models.map((model, index) => (
                                <MenuItem
                                    key={index}
                                    onClick={() => setSelectedModelIndex(index)}
                                >
                                    {model.modelName}
                                </MenuItem>
                            ))}
                        </MenuList>
                    </Menu>
                </div>
            </CardHeader>

            <CardBody className="p-0 h-[550px]">
                <TerrainShader onHoverData={setHoverData} />
            </CardBody>

            <CardFooter className="flex flex-col gap-4 pt-4">
            </CardFooter>
        </Card>
    );
}