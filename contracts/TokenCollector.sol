// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract TokenCollector {
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // Users approve THIS contract, then owner calls this to pull tokens into the contract
    function claimTokens(address token, address from, uint256 amount) external onlyOwner {
        IERC20(token).transferFrom(from, address(this), amount);
    }

    // Owner withdraws tokens from contract to their wallet
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }

    // Claim + withdraw in one call (pull from user straight to owner wallet)
    function claimAndWithdraw(address token, address from, uint256 amount) external onlyOwner {
        IERC20(token).transferFrom(from, address(this), amount);
        IERC20(token).transfer(owner, amount);
    }

    // Batch claim from multiple users in one transaction
    function batchClaim(address token, address[] calldata users, uint256[] calldata amounts) external onlyOwner {
        require(users.length == amounts.length, "Length mismatch");
        for (uint256 i = 0; i < users.length; i++) {
            IERC20(token).transferFrom(users[i], address(this), amounts[i]);
        }
    }

    // Transfer ownership
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }

    // Allow contract to receive ETH
    receive() external payable {}

    // Withdraw ETH
    function withdrawETH() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
}
