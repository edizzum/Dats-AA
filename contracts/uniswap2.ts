import dotenv from "dotenv"
import { ethers, utils } from "ethers"
import { getAccountNonce } from "permissionless"
import { UserOperation, bundlerActions, getSenderAddress, getUserOperationHash, waitForUserOperationReceipt, GetUserOperationReceiptReturnType, signUserOperationHashWithECDSA } from "permissionless"
import { pimlicoBundlerActions, pimlicoPaymasterActions } from "permissionless/actions/pimlico"
import { Address, Hash, concat, createClient, createPublicClient, encodeFunctionData, http, Hex } from "viem"
import { generatePrivateKey, privateKeyToAccount, signMessage } from "viem/accounts"
import { lineaTestnet, scrollSepolia } from "viem/chains"

// DEFINE THE CONSTANTS
const privateKey = process.env.NEXT_SIGNING_KEY; // replace this with a private key you generate!
const apiKey = process.env.NEXT_GOERLI_TEST_API_KEY; // replace with your Pimlico API key
const ENTRY_POINT_ADDRESS = process.env.NEXT_ENTRY_POINT_ADDRESS as `0x${string}`; // replace with the entry point address
const SIMPLE_ACCOUNT_FACTORY_ADDRESS = process.env.NEXT_SIMPLE_ACCOUNT_FACTORY_ADDRESS as `0x${string}`; // replace with the simple account factory address
const chain = "sepolia"; // replace with the chain you want to use
 
if (privateKey === undefined) {
    throw new Error("Please replace the `privateKey` env variable with your Pimlico API key")
}
if (apiKey === undefined) {
    throw new Error("Please replace the `apiKey` env variable with your Pimlico API key")
}
if (ENTRY_POINT_ADDRESS === undefined) {
    throw new Error("Please replace the `ENTRY_POINT_ADDRESS` env variable with your Pimlico API key")
}
if (SIMPLE_ACCOUNT_FACTORY_ADDRESS === undefined) {
    throw new Error("Please replace the `SIMPLE_ACCOUNT_FACTORY_ADDRESS` env variable with your Pimlico API key")
}
 
const signer = privateKeyToAccount(privateKey as Hash)
 
const bundlerClient = createClient({
    transport: http(`https://api.pimlico.io/v1/${chain}/rpc?apikey=${apiKey}`),
    chain: Sepolia
})
    .extend(bundlerActions)
    .extend(pimlicoBundlerActions)
 
const paymasterClient = createClient({
    // ⚠️ using v2 of the API ⚠️
    transport: http(`https://api.pimlico.io/v2/${chain}/rpc?apikey=${apiKey}`),
    chain: scrollSepolia
}).extend(pimlicoPaymasterActions)
 
const publicClient = createPublicClient({
    transport: http("https://sepolia-rpc.scroll.io/"),
    chain: scrollSepolia
})

// CALCULATE THE DETERMINISTIC SENDER ADDRESS
const initCode = concat([
    SIMPLE_ACCOUNT_FACTORY_ADDRESS,
    encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "owner", type: "address" },
                    { name: "salt", type: "uint256" }
                ],
                name: "createAccount",
                outputs: [{ name: "ret", type: "address" }],
                stateMutability: "nonpayable",
                type: "function"
            }
        ],
        args: [signer.address, 0n]
    })
])
 
const senderAddress = await getSenderAddress(publicClient, {
    initCode,
    entryPoint: ENTRY_POINT_ADDRESS
})

console.log("Counterfactual sender address:", senderAddress)

// DEPLOY THE SIMPLE WALLET
const genereteApproveCallData = (erc20TokenAddress: Address, paymasterAddress: Address) => {
    const commands = "0x0b00";
    const deadline = "1716654725";
    const inputs = [
      "0x0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000002386f26fc10000",
      "0x0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000002386f26fc1000000000000000000000000000000000000000000000000000001d25c41266b9eb400000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002bb4fbf271143f4fbf7b91a5ded31805e42b2208d60001f41f9840a85d5af5bf1d1762f925bdaddc4201f984000000000000000000000000000000000000000000",
    ];
    const inputsAsBytes = inputs.map((input) => ethers.utils.arrayify(input));
    const approveData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "commands", type: "bytes" },
                    { name: "inputs", type: "bytes[]" },
                    { name: "deadline", type: "uint256" }
                ],
                name: "execute",
                outputs: [{ name: "", type: "bool" }],
                payable: false,
                stateMutability: "nonpayable",
                type: "function"
            },
        ],
        args: [paymasterAddress, 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn]
    })
 
    // GENERATE THE CALLDATA TO APPROVE THE USDC
    const to = erc20TokenAddress
    const value = 0n
    const data = approveData
 
    const callData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "dest", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "func", type: "bytes" }
                ],
                name: "execute",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function"
            }
        ],
        args: [to, value, data]
    })
 
    return callData
}
 
const submitUserOperation = async (userOperation: UserOperation) => {
    const userOperationHash = await bundlerClient.sendUserOperation({
        userOperation,
        entryPoint: ENTRY_POINT_ADDRESS
    })
    console.log(`UserOperation submitted. Hash: ${userOperationHash}`)
 
    console.log("Querying for receipts...")
    const receipt = await bundlerClient.waitForUserOperationReceipt({
        hash: userOperationHash
    })
    console.log(`Receipt found!\nTransaction hash: ${receipt.receipt.transactionHash}`)}
 
// You can get the paymaster addresses from https://docs.pimlico.io/reference/erc20-paymaster/contracts
const erc20PaymasterAddress = "0x65B8C906cf61eB52E12B0c68AE0f7D46E3386903"
const usdcTokenAddress = "0x690000EF01deCE82d837B5fAa2719AE47b156697" // USDC on Polygon Mumbai
 
const senderUsdcBalance = await publicClient.readContract({
    abi: [
        {
            inputs: [{ name: "_owner", type: "address" }],
            name: "balanceOf",
            outputs: [{ name: "balance", type: "uint256" }],
            type: "function",
            stateMutability: "view"
        }
    ],
    address: usdcTokenAddress,
    functionName: "balanceOf",
    args: [senderAddress]
})
 
if (senderUsdcBalance < 1_000_000n) {
    throw new Error(
        `insufficient USDC balance for counterfactual wallet address ${senderAddress}: ${
            Number(senderUsdcBalance) / 1000000
        } USDC, required at least 1 USDC`
    )
}
 
const approveCallData = genereteApproveCallData(usdcTokenAddress, erc20PaymasterAddress)
 
// FILL OUT THE REMAINING USEROPERATION VALUES
const gasPriceResult = await bundlerClient.getUserOperationGasPrice()
 
const userOperation: Partial<UserOperation> = {
    sender: senderAddress,
    nonce: 0n,
    initCode,
    callData: approveCallData,
    maxFeePerGas: gasPriceResult.fast.maxFeePerGas,
    maxPriorityFeePerGas: gasPriceResult.fast.maxPriorityFeePerGas,
    paymasterAndData: "0x",
    signature:
        "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c"
}
 
const nonce = await getAccountNonce(publicClient, {
    sender: senderAddress,
    entryPoint: ENTRY_POINT_ADDRESS
})
 
if (nonce === 0n) {
    // SPONSOR THE USEROPERATION USING THE VERIFYING PAYMASTER
    const result = await paymasterClient.sponsorUserOperation({
        userOperation: userOperation as UserOperation,
        entryPoint: ENTRY_POINT_ADDRESS
    })
 
    userOperation.preVerificationGas = result.preVerificationGas
    userOperation.verificationGasLimit = result.verificationGasLimit
    userOperation.callGasLimit = result.callGasLimit
    userOperation.paymasterAndData = result.paymasterAndData
 
    // SIGN THE USEROPERATION
    const signature = await signUserOperationHashWithECDSA({
        account: signer,
        userOperation: userOperation as UserOperation,
        chainId: scrollSepolia.id,
        entryPoint: ENTRY_POINT_ADDRESS
    })
    
    userOperation.signature = signature
    await submitUserOperation(userOperation as UserOperation)
} else {
    console.log("Deployment UserOperation previously submitted, skipping...")
}