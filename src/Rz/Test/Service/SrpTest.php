<?php

namespace Rz\Test;

use Riimu\Kit\SecureRandom\SecureRandom;
use Rz\Service\Srp;
use Rz\Test\Mock\ControlledGenerator;

class SrpTest extends \PHPUnit_Framework_TestCase
{
  /**
   * @dataProvider userProvider
   */
  public function testProtocolInitialization($email, $salt, $verifier)
  {
    $srp = new Srp(new SecureRandom(new ControlledGenerator()));
    $srp->prepare($verifier, $salt);

    $challenge = $srp->issueChallenge();

    $expectedChallenge = $this->getIssueChallenge($email);

    $this->assertEquals($expectedChallenge, $challenge);
  }

  public function userProvider()
  {
    return [
      ['user@email.com', '655d1b17394eab9863066e1068eb23ee', '53022566c3307b1eb2caeb140768d85565756354cd7f381dbf99345e3c4e707b0ec016ba4d9ebe770adedb5560da8c4482a45e8a662127df79e12d5f3fcc8841d384027c835ea0f19e5df1fd0ef26ba83979a36bdc7d75700c777b1550e89ca85f53eb32a5d1012af7b54a68444bd2e15db1835bbc1d85405e6e5de9169a37f8'],
      ['user1@email.com', '6fe9aa721ae0ea953cf62c11475b955', 'cddcf038f7be4c03ae414c6b69dbc65bff4fbe56396195909dc68a2d3e171c022c44f06eff3c8212c00e7a569ab6918959945e994a27e8edd73e87bbd7852ed5b190ac00ae29db31aaaa90c05ea72c69d1fc3c4925912108de80f12cd181d7a8d78af69e26eacb67d62e5ea43b95523398b68d95d923b33952e6e01d4adf71b'],
      ['user2@email.com', '1c36a2e32d9de2b8626d179876eec756', '3458487a0f8fbe9ce548415cfa7214ade14eca164ac26ca5b98fd5bed62f534727567e74dabd2f7c8c536ba7081522145ecaab479ba8b9afb7510b861414f390bbd88341af1196227fa7ff255bbd0878552fde9b27da9eccde94cace7cd72fc13aff138f54fa563e2c2d61412c911e9c245c3984b34bf16b6549a8530ca3bb79'],
      ['user3@email.com', '3298740742b80db02a94b4e663311688', 'c8354f03f03f485260764299a68fc618a3fb64775600b980fb0b57c4b0721d0f495ce7ddc12415157712a7c2e7ada74b2ceefe15c1e194cf8ade11ef0d51f3615af35e6ad89b56f97f93a7343c0d6759ef15b601140533e229c01ad00a9320ad722687c51613f7bc3073653e864a906e059fdb96b0867daa406cb46b7f1b844'],
    ];
  }

  private function getIssueChallenge($email)
  {
    $data = [
      'user@email.com' => [
        'salt' => '655d1b17394eab9863066e1068eb23ee',
        'B' => '3d9ebfe64300097799d3995368c848603a02e1d07a71592ec1ef4216ecf54fd40a793ac713ea1b151ebd0540db26fae84609feaf89051db95fecae33c57dbb51a11cda9beb3c313f639eaf4f63aeb2654a4dd15ea0c43ccb1afb43386ee51c7f4a2024a16d190ddd267827f8cceecd25a6b0b01e7991560872c4dc105491fec1'
      ],
      'user1@email.com' => [
        'salt' => '6fe9aa721ae0ea953cf62c11475b955',
        'B' => 'c34e1698683615b5ba82574b425e6423cc599237ee33191fe11eb3a2f6ef5cbbba498448892b9899e8a337e4e6de0d9a9a1de8145fe3e80b88b48c736cf2b508999428cfed756d2375970d339d0d4bcc593ae962a552f702729afe02a37394b00840605059c4cfb797fa5a47968e0e54d3b42694806f6a23937f2f9019ea37aa'
      ],
      'user2@email.com' => [
        'salt' => '1c36a2e32d9de2b8626d179876eec756',
        'B' => '01eb94eeb665e700067d7d5c4c821215300300d710f05336ce40338d997f421f0a4f3c678da10c732c0a087446e17fb79426ffc936656f70fca2090f107445ec36fbb9ec0230311ae2310eb872c73bcc1f0ab16809b18d4ec5456ffc14d5e3fa86c2366ab411063ca3d292b127b1a692e091978bb803d558d4dbcfcf14af562f'
      ],
      'user3@email.com' => [
        'salt' => '3298740742b80db02a94b4e663311688',
        'B' => 'c707feefdfaf99dcd2c26135aeece5cc5e38e8f882a4263398e927a299bd732ebc69b8712555fdc4391bfadde48c7b7023338388281441ce73ed22d8a3fcfe0b8fa616a2df92d45dc74cd499da123170ec6bb81056dde58a85f4b9e7b5c64bb168a44e5afb581d166f196a8e791320c184ca7b29d522ec3c0fefdc0f03589408'
      ]
    ];

    return isset($data[$email]) ? $data[$email] : null;
  }
}