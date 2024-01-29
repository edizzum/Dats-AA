import dotenv from "dotenv";
import { ethers } from "ethers";
import { getAccountNonce } from "permissionless";
import { UserOperation, bundlerActions, getSenderAddress, signUserOperationHashWithECDSA } from "permissionless";
import { pimlicoBundlerActions, pimlicoPaymasterActions } from "permissionless/actions/pimlico";
import { Hash, concat, createClient, createPublicClient, encodeFunctionData, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
dotenv.config();

// DEFINE THE CONSTANTS
const signingKey = process.env.NEXT_SIGNING_KEY; // replace this with a private key you generate!
const apiKey = process.env.NEXT_GOERLI_TEST_API_KEY; // replace with your Pimlico API key
const entryPointAddress = process.env.NEXT_ENTRY_POINT_PUBLIC_ADDRESS as `0x${string}`; // replace with the entry point address
const erc20PaymasterAddress = process.env.NEXT_ERC20_PAYMASTER_ADDRESS as `0x${string}`; // replace with the erc20 paymaster address
const simpleAccountFactoryAddress = process.env.NEXT_SIMPLE_ACCOUNT_FACTORY_PUBLIC_ADDRESS as `0x${string}`; // replace with the simple account factory address
const datsContractFullAddress = process.env.NEXT_DATS_CONTRACT_FULL_PUBLIC_ADDRESS_SEPOLIA as `0x${string}`; // replace with the simple account factory address
const chain = "sepolia"; // replace with the chain you want to use
console.log(signingKey);

if (!signingKey) {
    throw new Error("The signing key is not defined in the environment variables.");
}
if (apiKey === undefined) {
    throw new Error(
        "Please replace the `apiKey` env variable with your Pimlico API key"
    );
}
if (entryPointAddress === undefined) {
    throw new Error(
        "Please replace the `ENTRY_POINT_ADDRESS` env variable with your Pimlico API key"
    );
}
if (erc20PaymasterAddress === undefined) {
    throw new Error(
        "Please replace the `ENTRY_POINT_ADDRESS` env variable with your Pimlico API key"
    );
}
if (simpleAccountFactoryAddress === undefined) {
    throw new Error(
        "Please replace the `SIMPLE_ACCOUNT_FACTORY_ADDRESS` env variable with your Pimlico API key"
    );
}
if (datsContractFullAddress === undefined) {
    throw new Error(
        "Please replace the `NEXT_DATS_CONTRACT_FULL_PUBLIC_ADDRESS_SEPOLIA` env variable with your Pimlico API key"
    );
}

const formattedSigningKey = signingKey.startsWith('0x') ? signingKey : `0x${signingKey}`;
const signer = privateKeyToAccount(formattedSigningKey as Hash);

const bundlerClient = createClient({
    transport: http(`https://api.pimlico.io/v1/${chain}/rpc?apikey=${apiKey}`),
    chain: sepolia,
})
    .extend(bundlerActions)
    .extend(pimlicoBundlerActions);

const paymasterClient = createClient({
    // ⚠️ using v2 of the API ⚠️
    transport: http(`https://api.pimlico.io/v2/${chain}/rpc?apikey=${apiKey}`),
    chain: sepolia,
}).extend(pimlicoPaymasterActions);

const publicClient = createPublicClient({
    transport: http("https://rpc.sepolia.org"),
    chain: sepolia,
});

// CALCULATE THE DETERMINISTIC SENDER ADDRESS
const initCode = concat([
    simpleAccountFactoryAddress,
    encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "owner", type: "address" },
                    { name: "salt", type: "uint256" },
                ],
                name: "createAccount",
                outputs: [{ name: "ret", type: "address" }],
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [signer.address, 0n],
    }),
]);

const senderAddress = await getSenderAddress(publicClient, {
    initCode,
    entryPoint: entryPointAddress,
});

console.log("Counterfactual sender address:", senderAddress);

const generateCreateAccountCallData = ({ email }: { email: string }) => {
    let hexString = "";
    hexString = "0x" + Buffer.from(email, "utf8").toString("hex");
    const salt = hexString;
    const createAccountData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "owner", type: "address" },
                    { name: "salt", type: "uint256" },
                ],
                name: "createAccount",
                outputs: [{ name: "ret", type: "address" }],
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [signer.address, BigInt(salt)],
    });

    const to = simpleAccountFactoryAddress;
    const value = 0n;
    const data = createAccountData;

    const callData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "dest", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "func", type: "bytes" },
                ],
                name: "execute",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [to, value, data],
    });

    return callData;
};

const generateGetAddressCallData = ({ _owner, email }: { _owner: string, email: string }) => {
    let hexString = "";
    hexString = "0x" + Buffer.from(email, "utf8").toString("hex");
    const salt = hexString;
    const ownerAddress = _owner as `0x${string}`;
    const getAddressData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "owner", type: "address" },
                    { name: "salt", type: "uint256" },
                ],
                name: "getAddress",
                outputs: [{ name: "", type: "address" }],
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [ownerAddress, BigInt(salt)],
    });

    const to = simpleAccountFactoryAddress;
    const value = 0n;
    const data = getAddressData;

    const callData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "dest", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "func", type: "bytes" },
                ],
                name: "execute",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [to, value, data],
    });

    return callData;
};

const generateGetAllUserDDosSettingsCallData = () => {
    const getAllUserDDosSettingsData = encodeFunctionData({
        abi: [
            {
                inputs: [],
                name: "getAllUserDDosSettings",
                outputs: [{ name: "id", type: "uint256" },
                { name: "user", type: "address" },
                { name: "isApprove", type: "bool" },
                { name: "trafficScale", type: "uint8" }],
                payable: false,
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
    });

    // GENERATE THE CALLDATA TO APPROVE THE USDC
    const to = datsContractFullAddress;
    const value = 0n;
    const data = getAllUserDDosSettingsData;

    const callData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "dest", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "func", type: "bytes" },
                ],
                name: "execute",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [to, value, data],
    });

    return callData;
};

const generateSaveDDosCallData = (
    _isApprove: boolean,
    _trafficScale: number
) => {
    const isApprove = _isApprove;
    const trafficScale = _trafficScale;
    const saveDDosData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "_isApprove", type: "bool" },
                    { name: "_trafficScale", type: "uint8" },
                ],
                name: "saveDDos",
                outputs: [],
                payable: false,
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [isApprove, trafficScale],
    });

    // GENERATE THE CALLDATA TO APPROVE THE USDC
    const to = datsContractFullAddress;
    const value = 0n;
    const data = saveDDosData;

    const callData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "dest", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "func", type: "bytes" },
                ],
                name: "execute",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [to, value, data],
    });

    return callData;
};

const genereGetDDosteCallData = () => {
    const getDDosData = encodeFunctionData({
        abi: [
            {
                inputs: [],
                name: "getDDos",
                outputs: [{ name: "id", type: "uint256" },
                { name: "user", type: "address" },
                { name: "isApprove", type: "bool" },
                { name: "trafficScale", type: "uint8" }],
                payable: false,
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
    });

    // GENERATE THE CALLDATA TO APPROVE THE USDC
    const to = datsContractFullAddress;
    const value = 0n;
    const data = getDDosData;

    const callData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "dest", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "func", type: "bytes" },
                ],
                name: "execute",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [to, value, data],
    });

    return callData;
};

const generateGetDDosByUserCallData = (_user: string) => {
    const userAddress = _user as `0x${string}`;
    const getDDosByUserData = encodeFunctionData({
        abi: [
            {
                inputs: [{ name: "_user", type: "address" }],
                name: "getDDosByUser",
                outputs: [{ name: "id", type: "uint256" },
                { name: "user", type: "address" },
                { name: "isApprove", type: "bool" },
                { name: "trafficScale", type: "uint8" }],
                payable: false,
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [userAddress],
    });

    // GENERATE THE CALLDATA TO APPROVE THE USDC
    const to = datsContractFullAddress;
    const value = 0n;
    const data = getDDosByUserData;

    const callData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "dest", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "func", type: "bytes" },
                ],
                name: "execute",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [to, value, data],
    });

    return callData;
};

const generateGetDDosCountCallData = () => {
    const getDDosCountData = encodeFunctionData({
        abi: [
            {
                inputs: [],
                name: "getDDosCount",
                outputs: [{ name: "", type: "uint256" }],
                payable: false,
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
    });

    // GENERATE THE CALLDATA TO APPROVE THE USDC
    const to = datsContractFullAddress;
    const value = 0n;
    const data = getDDosCountData;

    const callData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "dest", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "func", type: "bytes" },
                ],
                name: "execute",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [to, value, data],
    });

    return callData;
};

const generateGetAllUserSuperComputerSettingsCallData = () => {
    const getAllUserSuperComputerSettingsData = encodeFunctionData({
        abi: [
            {
                inputs: [],
                name: "getAllUserSuperComputerSettings",
                outputs: [{ name: "id", type: "uint256" },
                { name: "user", type: "address" },
                { name: "isApprove", type: "bool" },
                { name: "cpuValue", type: "uint8" }
            ],
                payable: false,
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
    });

    // GENERATE THE CALLDATA TO APPROVE THE USDC
    const to = datsContractFullAddress;
    const value = 0n;
    const data = getAllUserSuperComputerSettingsData;

    const callData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "dest", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "func", type: "bytes" },
                ],
                name: "execute",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [to, value, data],
    });

    return callData;
};

const generateSaveSuperComputerCallData = (
    _isApprove: boolean,
    _cpuValue: number
) => {
    const isApprove = _isApprove;
    const cpuValue = _cpuValue;
    const saveSuperComputerData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "_isApprove", type: "bool" },
                    { name: "_cpuValue", type: "uint8" },
                ],
                name: "saveSuperComputer",
                outputs: [{ name: "", type: "" }],
                payable: false,
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [isApprove, cpuValue],
    });

    // GENERATE THE CALLDATA TO APPROVE THE USDC
    const to = datsContractFullAddress;
    const value = 0n;
    const data = saveSuperComputerData;

    const callData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "dest", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "func", type: "bytes" },
                ],
                name: "execute",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [to, value, data],
    });

    return callData;
};

const generateGetSuperComputerCallData = () => {
    const getSuperComputerData = encodeFunctionData({
        abi: [
            {
                inputs: [],
                name: "getSuperComputer",
                outputs: [{ name: "id", type: "uint256" },
                { name: "user", type: "address" },
                { name: "isApprove", type: "bool" },
                { name: "cpuValue", type: "uint8" }
            ],
                payable: false,
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
    });

    // GENERATE THE CALLDATA TO APPROVE THE USDC
    const to = datsContractFullAddress;
    const value = 0n;
    const data = getSuperComputerData;

    const callData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "dest", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "func", type: "bytes" },
                ],
                name: "execute",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [to, value, data],
    });

    return callData;
};

const generateGetSuperComputerByUserCallData = (_user: string) => {
    const user = _user as `0x${string}`;
    const getSuperComputerByUserData = encodeFunctionData({
        abi: [
            {
                inputs: [{ name: "_user", type: "address" }],
                name: "getSuperComputerByUser",
                outputs: [{ name: "id", type: "uint256" },
                { name: "user", type: "address" },
                { name: "isApprove", type: "bool" },
                { name: "cpuValue", type: "uint8" }
            ],
                payable: false,
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [user],
    });

    // GENERATE THE CALLDATA TO APPROVE THE USDC
    const to = datsContractFullAddress;
    const value = 0n;
    const data = getSuperComputerByUserData;

    const callData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "dest", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "func", type: "bytes" },
                ],
                name: "execute",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [to, value, data],
    });

    return callData;
};

const generateGetSuperComputerCountCallData = () => {
    const getSuperComputerCountData = encodeFunctionData({
        abi: [
            {
                inputs: [],
                name: "getSuperComputerCount",
                outputs: [{ name: "", type: "uint256" }],
                payable: false,
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
    });

    // GENERATE THE CALLDATA TO APPROVE THE USDC
    const to = datsContractFullAddress;
    const value = 0n;
    const data = getSuperComputerCountData;

    const callData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "dest", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "func", type: "bytes" },
                ],
                name: "execute",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [to, value, data],
    });

    return callData;
};

const generateGetAllUserCyberSecuritySettingsCallData = () => {
    const getAllUserCyberSecuritySettingsData = encodeFunctionData({
        abi: [
            {
                inputs: [],
                name: "getAllUserCyberSecuritySettings",
                outputs: [{ name: "id", type: "address" },
                { name: "user", type: "address" },
                { name: "isApprove", type: "bool" },
                { name: "webSecurity", type: "bool" },
                { name: "serverSecurity", type: "bool" },
                { name: "ransomwareResearch", type: "bool" },
                { name: "malwareResearch", type: "bool" }], 
                payable: false,
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
    });

    // GENERATE THE CALLDATA TO APPROVE THE USDC
    const to = datsContractFullAddress;
    const value = 0n;
    const data = getAllUserCyberSecuritySettingsData;

    const callData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "dest", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "func", type: "bytes" },
                ],
                name: "execute",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [to, value, data],
    });

    return callData;
};

const generateSaveCyberSecurityCallData = (
    _isApprove: boolean,
    _webSecurity: boolean,
    _serverSecurity: boolean,
    _ransomwareResearch: boolean,
    _malwareResearch: boolean
) => {
    const isApprove = _isApprove;
    const webSecurity = _webSecurity;
    const serverSecurity = _serverSecurity;
    const ransomwareResearch = _ransomwareResearch;
    const malwareResearch = _malwareResearch;
    const saveCyberSecurityData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "_isApprove", type: "bool" },
                    { name: "_webSecurity", type: "bool" },
                    { name: "_serverSecurity", type: "bool" },
                    { name: "_ransomwareResearch", type: "bool" },
                    { name: "_malwareResearch", type: "bool" },
                ],
                name: "saveCyberSecurity",
                outputs: [{ name: "", type: "" }],
                payable: false,
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [
            isApprove,
            webSecurity,
            serverSecurity,
            ransomwareResearch,
            malwareResearch,
        ],
    });

    // GENERATE THE CALLDATA TO APPROVE THE USDC
    const to = datsContractFullAddress;
    const value = 0n;
    const data = saveCyberSecurityData;

    const callData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "dest", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "func", type: "bytes" },
                ],
                name: "execute",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [to, value, data],
    });

    return callData;
};

const generateGetCyberSecurityCallData = () => {
    const getCyberSecurityData = encodeFunctionData({
        abi: [
            {
                inputs: [],
                name: "getCyberSecurity",
                outputs: [{ name: "id", type: "address" },
                { name: "user", type: "address" },
                { name: "isApprove", type: "bool" },
                { name: "webSecurity", type: "bool" },
                { name: "serverSecurity", type: "bool" },
                { name: "ransomwareResearch", type: "bool" },
                { name: "malwareResearch", type: "bool" }], 
                payable: false,
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
    });

    // GENERATE THE CALLDATA TO APPROVE THE USDC
    const to = datsContractFullAddress;
    const value = 0n;
    const data = getCyberSecurityData;

    const callData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "dest", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "func", type: "bytes" },
                ],
                name: "execute",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [to, value, data],
    });

    return callData;
};

const generateGetCyberSecurityCountCallData = () => {
    const getCyberSecurityCountData = encodeFunctionData({
        abi: [
            {
                inputs: [],
                name: "getCyberSecurityCount",
                outputs: [{ name: "", type: "uint256" }],
                payable: false,
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
    });

    // GENERATE THE CALLDATA TO APPROVE THE USDC
    const to = datsContractFullAddress;
    const value = 0n;
    const data = getCyberSecurityCountData;

    const callData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "dest", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "func", type: "bytes" },
                ],
                name: "execute",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [to, value, data],
    });

    return callData;
};

const generateGetAllUserVulnerabilitySettingsCallData = () => {
    const getAllUserVulnerabilitySettingsData = encodeFunctionData({
        abi: [
            {
                inputs: [],
                name: "getAllUserVulnerabilitySettings",
                outputs: [{ name: "id", type: "uint256" },
                { name: "user", type: "address" },
                { name: "isApprove", type: "bool" },
                { name: "isApprove", type: "bool" },
                { name: "webPenetration", type: "bool" },
                { name: "serverPenetration", type: "bool" },
                { name: "scadaPenetration", type: "bool" },
                { name: "blockchainPenetration", type: "bool" },
                { name: "contractPenetration", type: "bool" }],
                payable: false,
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
    });

    // GENERATE THE CALLDATA TO APPROVE THE USDC
    const to = datsContractFullAddress;
    const value = 0n;
    const data = getAllUserVulnerabilitySettingsData;

    const callData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "dest", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "func", type: "bytes" },
                ],
                name: "execute",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [to, value, data],
    });

    return callData;
};

const generateSaveVulnerabilityCallData = (
    _isApprove: boolean,
    _webPenetration: boolean,
    _serverPenetration: boolean,
    _scadaPenetration: boolean,
    _blockchainPenetration: boolean,
    _contractPenetration: boolean
) => {
    const isApprove = _isApprove;
    const webPenetration = _webPenetration;
    const serverPenetration = _serverPenetration;
    const scadaPenetration = _scadaPenetration;
    const blockchainPenetration = _blockchainPenetration;
    const contractPenetration = _contractPenetration;
    const saveVulnerabilityData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "_isApprove", type: "bool" },
                    { name: "_webPenetration", type: "bool" },
                    { name: "_serverPenetration", type: "bool" },
                    { name: "_scadaPenetration", type: "bool" },
                    { name: "_blockchainPenetration", type: "bool" },
                    { name: "_contractPenetration", type: "bool" },
                ],
                name: "saveVulnerability",
                outputs: [{ name: "", type: "" }],
                payable: false,
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [
            isApprove,
            webPenetration,
            serverPenetration,
            scadaPenetration,
            blockchainPenetration,
            contractPenetration,
        ],
    });

    // GENERATE THE CALLDATA TO APPROVE THE USDC
    const to = datsContractFullAddress;
    const value = 0n;
    const data = saveVulnerabilityData;

    const callData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "dest", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "func", type: "bytes" },
                ],
                name: "execute",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [to, value, data],
    });

    return callData;
};

const generateGetVulnerabilityCallData = () => {
    const getVulnerabilityData = encodeFunctionData({
        abi: [
            {
                inputs: [],
                name: "getVulnerability",
                outputs: [{ name: "id", type: "uint256" },
                { name: "user", type: "address" },
                { name: "isApprove", type: "bool" },
                { name: "isApprove", type: "bool" },
                { name: "webPenetration", type: "bool" },
                { name: "serverPenetration", type: "bool" },
                { name: "scadaPenetration", type: "bool" },
                { name: "blockchainPenetration", type: "bool" },
                { name: "contractPenetration", type: "bool" }],
                payable: false,
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
    });

    // GENERATE THE CALLDATA TO APPROVE THE USDC
    const to = datsContractFullAddress;
    const value = 0n;
    const data = getVulnerabilityData;

    const callData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "dest", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "func", type: "bytes" },
                ],
                name: "execute",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [to, value, data],
    });

    return callData;
};

const generateGetVulnerabilityCountCallData = () => {
    const getVulnerabilityCountData = encodeFunctionData({
        abi: [
            {
                inputs: [],
                name: "getVulnerabilityCount",
                outputs: [{ name: "", type: "uint256" }],
                payable: false,
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
    });

    // GENERATE THE CALLDATA TO APPROVE THE USDC
    const to = datsContractFullAddress;
    const value = 0n;
    const data = getVulnerabilityCountData;

    const callData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "dest", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "func", type: "bytes" },
                ],
                name: "execute",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [to, value, data],
    });

    return callData;
};

const generateGetAllUserBlockchainSettingsCallData = () => {
    const getAllUserBlockchainSettingsData = encodeFunctionData({
        abi: [
            {
                inputs: [],
                name: "getAllUserBlockchainSettings",
                outputs: [{ name: "", type: "addres" }],
                payable: false,
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
    });

    // GENERATE THE CALLDATA TO APPROVE THE USDC
    const to = datsContractFullAddress;
    const value = 0n;
    const data = getAllUserBlockchainSettingsData;

    const callData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "dest", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "func", type: "bytes" },
                ],
                name: "execute",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [to, value, data],
    });

    return callData;
};

const generateSaveBlockchainCallData = (_approveAttackPrevention: boolean) => {
    const approveAttackPrevention = _approveAttackPrevention;
    const saveBlockchainData = encodeFunctionData({
        abi: [
            {
                inputs: [{ name: "_approveAttackPrevention", type: "bool" }],
                name: "saveBlockchain",
                outputs: [{ name: "ret", type: "address" }],
                payable: false,
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [approveAttackPrevention],
    });

    // GENERATE THE CALLDATA TO APPROVE THE USDC
    const to = datsContractFullAddress;
    const value = 0n;
    const data = saveBlockchainData;

    const callData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "dest", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "func", type: "bytes" },
                ],
                name: "execute",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [to, value, data],
    });

    return callData;
};

const generateGetBlockchainCallData = () => {
    const getBlockchainData = encodeFunctionData({
        abi: [
            {
                inputs: [],
                name: "getBlockchain",
                outputs: [
                    { name: "id", type: "uint256" },
                    { name: "user", type: "address" },
                    { name: "approveAttackPrevention", type: "bool" }
                ],
                payable: false,
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
    });

    // GENERATE THE CALLDATA TO APPROVE THE USDC
    const to = datsContractFullAddress;
    const value = 0n;
    const data = getBlockchainData;

    const callData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "dest", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "func", type: "bytes" },
                ],
                name: "execute",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [to, value, data],
    });

    return callData;
};

const generateGetBlockchainCountCallData = () => {
    const getBlockchainCountData = encodeFunctionData({
        abi: [
            {
                inputs: [],
                name: "getBlockchainCount",
                outputs: [{ name: "", type: "uint256" }],
                payable: false,
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
    });

    // GENERATE THE CALLDATA TO APPROVE THE USDC
    const to = datsContractFullAddress;
    const value = 0n;
    const data = getBlockchainCountData;

    const callData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "dest", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "func", type: "bytes" },
                ],
                name: "execute",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [to, value, data],
    });

    return callData;
};

const submitUserOperation = async (userOperation: UserOperation) => {
    const userOperationHash = await bundlerClient.sendUserOperation({
        userOperation,
        entryPoint: entryPointAddress,
    });
    console.log(`UserOperation submitted. Hash: ${userOperationHash}`);

    console.log("Querying for receipts...");
    const receipt = await bundlerClient.waitForUserOperationReceipt({
        hash: userOperationHash,
    });
    console.log(
        `Receipt found!\nTransaction hash: ${receipt.receipt.transactionHash}`
    );
};

// const approveCallData = genereteApproveCallData(usdcTokenAddress, erc20PaymasterAddress)

// FILL OUT THE REMAINING USEROPERATION VALUES
const gasPriceResult = await bundlerClient.getUserOperationGasPrice();

const nonceOfAccount = await getAccountNonce(publicClient, {
    sender: senderAddress,
    entryPoint: entryPointAddress,
});

let dynamicInitCode;

if (nonceOfAccount === 0n) {
    console.log("Sender address is 0x, creating...");
    dynamicInitCode = initCode;
} else {
    dynamicInitCode = "0x" as `0x${string}`;
}


const approveCallData = generateCreateAccountCallData({
    email: "lolumsu@gmail.com",
});

const getAddressCallData = generateGetAddressCallData({
    _owner: signer.address,
    email: "lolumsu@gmail.com",
});

const userOperation: Partial<UserOperation> = {
    sender: senderAddress,
    nonce: nonceOfAccount,
    initCode: dynamicInitCode,
    callData: approveCallData,
    maxFeePerGas: gasPriceResult.fast.maxFeePerGas,
    maxPriorityFeePerGas: gasPriceResult.fast.maxPriorityFeePerGas,
    paymasterAndData: "0x",
    signature:
        "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c",
};

// SPONSOR THE USEROPERATION USING THE VERIFYING PAYMASTER
const result = await paymasterClient.sponsorUserOperation({
    userOperation: userOperation as UserOperation,
    entryPoint: entryPointAddress,
});

userOperation.preVerificationGas = result.preVerificationGas;
userOperation.verificationGasLimit = result.verificationGasLimit;
userOperation.callGasLimit = result.callGasLimit;
userOperation.paymasterAndData = result.paymasterAndData;

// SIGN THE USEROPERATION
const signature = await signUserOperationHashWithECDSA({
    account: signer,
    userOperation: userOperation as UserOperation,
    chainId: sepolia.id,
    entryPoint: entryPointAddress,
});

userOperation.signature = signature;
const outputOfUserOperation = await submitUserOperation(userOperation as UserOperation);
console.log(outputOfUserOperation);