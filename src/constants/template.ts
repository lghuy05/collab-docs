
export const templates = [
  {
    id: "blank",
    label: "Blank Document",
    imageUrl: "/default_doc.svg",
    initialContent: ""
  },
  {
    id: "software-proposal",
    label: "Software Development proposal",
    imageUrl: "/software_proposal.svg",
    initialContent: `

    <p><em>[Cover design / header graphic]</em></p>

    <h1>SOFTWARE<br>PROPOSAL</h1>

    <hr>

    <p><strong>PREPARED FOR</strong></p>
    <p>
      <strong>[Client Name]</strong><br>
      Client Company
    </p>

    <p><strong>PREPARED BY</strong></p>
    <p>
      <strong>[Your Name]</strong><br>
      Your Company
    </p>`

  },
  {
    id: "project-proposal",
    label: "Project proposal",
    imageUrl: "/proposal.svg",
    initialContent: `
    <p><em>[Cover image]</em></p>

    <h1>Project Proposal</h1>
    <p>September 4, 2023</p>

    <hr>

    <p><strong>PREPARED BY</strong></p>
    <p>
      <strong>[Your Name]</strong><br>
      Your Company<br>
      123 Your Street<br>
      Your City, ST 12345<br>
      email@company.com<br>
      (123) 456-7890
    </p>

    <hr>

    <p><strong>PREPARED FOR</strong></p>
    <p>
      <strong>[Client Name]</strong><br>
      [Client Company]<br>
      456 Client Street<br>
      Client City, ST 67890
    </p>`


  },
  {
    id: "business-letter",
    label: "Business letter",
    imageUrl: "/business_letter.svg",
    initialContent: `

    <table>
      <tbody>
        <tr>
          <td>
            <table>
              <tbody>
                <tr>
                  <td><p>🟦</p></td>
                  <td><p><strong>Your Company</strong></p></td>
                </tr>
              </tbody>
            </table>

            <p>
              123 Business Ave, City, State 12345<br>
              (123) 456-7890<br>
              info@yourcompany.com<br>
              www.yourcompany.com
            </p>
          </td>
          <td>
            <p>April 24, 2024</p>
          </td>
        </tr>
      </tbody>
    </table>

    <p>
      <strong>John Doe.</strong><br>
      Position.<br>
      Company Name.<br>
      456 Office Park, City, State 67890.
    </p>

    <p><strong>Dear Mr. Doe.</strong></p>

    <p>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Musésdnod tigmtdodor
      vclllæuntut l.lane, et penatrattmu. Nencillus suqeeuficus. Sesi aliqua, necnarrates
      gaote nectum.
    </p>

    <p>
      Funs cendritis qularna in aæeis neecutit to vpenitat ur ullamc c. labere. Erlluæaliquæ
      debænire moneticas. Inrriet aliq ue, ocrerat requ er, necatent faocttunsil ut laliqup
      ex ea commodo fabgittin velis.
    </p>

    <p>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Musésdnod tigmtdodor.
      vclllæuntut l.lane, et penatrattmu. Nencillus suqeeuficus. Sesi aliqua, recpernates
      gaote nectum.
    </p>

    <p>Sincerely.</p>

    <p><strong>Your Name</strong><br>Your Position</p>`
  },
  {
    id: "resume",
    label: "Resume",
    imageUrl: "/resume.svg",
    initialContent: `

    <table>
      <tbody>
        <tr>
          <td><p><em>[Avatar]</em></p></td>
          <td>
            <h1>[Your Name]</h1>
            <p>[Your Job Title]</p>
          </td>
        </tr>
      </tbody>
    </table>

    <p>
      email@youremail.com &nbsp; | &nbsp; (123) 456-7890 &nbsp; | &nbsp; City, State &nbsp; | &nbsp; linkedin.com/in/yourname
    </p>

    <hr>

    <table>
      <tbody>
        <tr>
          <!-- LEFT COLUMN -->
          <td>
            <h2>PROFILE</h2>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vitae risus posuere,
              dapibus metus eget, fermentum lacus. Curabitur molestie dictum viverra. Vivamus
              gravida ut libero ut varius.
            </p>

            <hr>

            <h2>SKILLS</h2>
            <ul>
              <li>Skill 1 — ●●●●○</li>
              <li>Skill 2 — ●●●○○</li>
              <li>Skill 3 — ●●●●○</li>
              <li>Skill 4 — ●●○○○</li>
              <li>Skill 5 — ●●●○○</li>
            </ul>

            <hr>

            <h2>EDUCATION</h2>
            <p><strong>Degree</strong> | Major<br>University Name | City, State<br>20XX - 20XX</p>
            <ul>
              <li>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</li>
              <li>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</li>
              <li>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</li>
            </ul>
          </td>

          <!-- RIGHT COLUMN -->
          <td>
            <h2>PROFESSIONAL EXPERIENCE</h2>

            <h3>[Job Title]</h3>
            <p>[Company Name] | [City, State] &nbsp; — &nbsp; 20XX - Present</p>
            <ul>
              <li>Suspendisse in malesuada ipsum. Nulla facilisi, aenean dignissim tellus in urna vehicula aliquet.</li>
              <li>Integer tempus libero sit amet scelerisque sollicitudin.</li>
              <li>Proin non lectus nec est auctor finibus.</li>
            </ul>

            <hr>

            <h3>[Job Title]</h3>
            <p>[Company Name] | [City, State] &nbsp; — &nbsp; 20XX - Present</p>
            <ul>
            <li>Aliquam fermentum quam, nec tincidunt nibh auctor eu.</li>
            <li>Sed condimentum elit eget felis interdum suscipit.</li>
            <li>Fusce bibendum sapien vitae pellentesque auctor.</li>
          </ul>

          <hr>

          <h3>[Job Title]</h3>
          <p>[Company Name] | [City, State] &nbsp; — &nbsp; 20XX - Present</p>
          <ul>
            <li>Aliquam fermentum quam, nec tincidunt nibh auctor eu.</li>
            <li>Sed condimentum elit eget felis interdum suscipit.</li>
            <li>Fusce bibendum sapien vitae pellentesque auctor.</li>
          </ul>

          <hr>

          <h2>CERTIFICATIONS</h2>
          <ul>
            <li>[Certification Name]</li>
            <li>[Certification Name]</li>
          </ul>
        </td>
      </tr>
    </tbody>
  </table>`


  },
  {
    id: "cover-letter",
    label: "Cover letter",
    imageUrl: "/cover_letter.svg",
    initialContent: `
    <table>
      <tbody>
        <tr>
          <td>
            <table>
              <tbody>
                <tr>
                  <td><p>🟦</p></td>
                  <td><p><strong>Your Company</strong></p></td>
                </tr>
              </tbody>
            </table>

            <p>
              123 Business Ave, City, State 12345<br>
              (123) 456-7890<br>
              info@yourcompany.com<br>
              www.yourcompany.com
            </p>
          </td>
          <td>
            <p>April 24, 2024</p>
          </td>
        </tr>
      </tbody>
    </table>

    <p>
      <strong>Hiring Manager</strong><br>
      Company Name<br>
      456 Office Park<br>
      City, State 67890
    </p>

    <p><strong>Dear Hiring Manager,</strong></p>

    <p>
      I am writing to express my interest in the <strong>[Job Title]</strong> position at <strong>[Company Name]</strong>
      as advertised on <strong>[Where You Found the Job Listing]</strong>. I believe my skills and experiences make me
      a strong candidate for this role.
    </p>

    <p>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Musésdnod tigmtdodoa a tidllanituntr u.
      L.ane, e penatratium, inecillus supuevitius. Sesi aliqua, recennertta oeates nectum.
      Eliam ali:qua re conseqsuat eapete nectum.
    </p>

    <p>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Musésdnod tigmtdodoa a tidllanituntr u.
      L.ane, e penatratium, inecillus supuevitius. Sesi aliqua, recennertta oeates nectum.
      Eliam ali:qua re conseqsuat eapete nectum.
    </p>

    <p>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Musésdnod tigmtdodoa a tidllanituntr u.
      L.ane, e penatratium, inecillus supuevitius. Sesi aliqua, recennertta oeates nectum.
      Eliam ali:qua re conseqsuat eapete nectum.
    </p>

    <p>Sincerely,</p>

    <p><strong>Your Name</strong><br>Your Position</p>`

  },
  {
    id: "letter",
    label: "Letter",
    imageUrl: "/letter.svg",
    initialContent: `
      <table>
        <tbody>
          <tr>
            <td></td>
            <td><p>April 24, 2024</p></td>
          </tr>
        </tbody>
      </table>

      <p><strong>Recipient Name</strong><br>Recipient Address Line 1<br>Recipient Address Line 2<br>City, State 67890</p>

      <p><strong>Dear [Recipient's Name],</strong></p>

      <p>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce ligula justo,
        fermentum nec nisi nec, luctus tempor erat. Mauris tincidunt id justo vel congue.
        Vivamus imperdiet ut libero ut tristique. Sincerely felis convallis nisi, a ultricies dui
        volutpat et.
      </p>

      <p>
        Integer feugiat orci vel euismod gravida. Donec id felis sem. Ut facilisis magna sed lacus
        mattis ultricies. Curabitur imperdiet condimentum erat, ut fermentum dui molestie id.
        Mauris gravida massa hendrerit quam venenatis, in efficitur metus varius.
      </p>

      <p>
        Vestibulum id metus sed sapien vehicula dictum. Donec tristique lacus a dui condimentum laoreet.
        Vestibulum efficitur facilisis egestas. Phasellus venenatis urna justo, ac dictum ligula
        facilisis id.
      </p>

      <p>Sincerely,</p>

  <p><strong>[Your Name]</strong><br>Your Position</p>`

  },
];
